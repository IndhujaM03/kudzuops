import os
import json
import time
import threading
from datetime import datetime
from typing import Tuple

from watchdog.observers import Observer  # type: ignore
from watchdog.events import FileSystemEventHandler  # type: ignore
import shutil
import psycopg


class _CVHandler(FileSystemEventHandler):
    def __init__(self, recruiter_id: int, demand_id: int, base_folder: str, dsn: str):
        super().__init__()
        self.recruiter_id = recruiter_id
        self.demand_id = demand_id
        self.base_folder = base_folder
        self.dsn = dsn

    def on_created(self, event):  # type: ignore[override]
        if event.is_directory:
            return
        filename = os.path.basename(event.src_path)
        ts = datetime.utcnow().isoformat()
        # Only accept .pdf or .docx
        lower = filename.lower()
        if not (lower.endswith('.pdf') or lower.endswith('.docx')):
            return
        # Build target directory and file
        try:
            target_dir = os.path.join(self.base_folder, 'demand', str(self.recruiter_id), str(self.demand_id))
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, filename)
        except Exception as e:
            print(f"⚠️ Unable to ensure target folder: {e}")
            return

        # Copy file (keep original)
        try:
            shutil.copy(event.src_path, target_path)
            print(f"✅ Copied {filename} to {target_path}")
        except PermissionError:
            print("Permission denied while copying file.")
            return
        except FileNotFoundError:
            print("Recruiter folder not found.")
            return
        except Exception as e:
            print(f"❌ Error copying file: {filename} - {e}")
            return

        # Best-effort DB update to reflect detection in cv_list
        try:
            with psycopg.connect(self.dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, cv_list FROM tbl_recruiter_activity 
                        WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing' 
                        ORDER BY id DESC LIMIT 1
                        """,
                        (self.recruiter_id, self.demand_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        return
                    activity_id, cv_list = row
                    try:
                        current = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                    except Exception:
                        current = []
                    current.append({"file": filename, "time": ts, "path": target_path.replace('\\', '/')})
                    cur.execute(
                        "UPDATE tbl_recruiter_activity SET cv_list = %s::jsonb, updated_at=NOW() WHERE id=%s",
                        (json.dumps(current), activity_id),
                    )
                    # Note: uploaded_cv_count is not recalculated here as this is just file detection
                    # The count will be updated when candidate details are added via other endpoints
                    conn.commit()
        except Exception:
            # Best-effort; ignore failures to avoid crashing the observer
            pass


def start_listener(recruiter_id: int, demand_id: int, watch_folder: str, base_folder: str, dsn: str) -> Tuple[threading.Event, threading.Thread]:
    stop_event = threading.Event()

    def _run():
        # Delay to allow folder to exist/be mounted
        os.makedirs(watch_folder, exist_ok=True)
        os.makedirs(base_folder, exist_ok=True)
        event_handler = _CVHandler(recruiter_id, demand_id, base_folder, dsn)
        observer = Observer()
        observer.schedule(event_handler, path=watch_folder, recursive=False)
        observer.start()
        try:
            while not stop_event.is_set():
                time.sleep(0.5)
        finally:
            observer.stop()
            observer.join(timeout=5)

    t = threading.Thread(target=_run, name=f"cv-listener-{recruiter_id}", daemon=True)
    t.start()
    return stop_event, t


