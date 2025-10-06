import os
import sys
from typing import Optional

import psycopg
from psycopg.rows import tuple_row


def try_connect(user: str, password: Optional[str]) -> Optional[list[str]]:
    try:
        with psycopg.connect(
            dbname="postgres",
            host=os.getenv("PGHOST", "127.0.0.1"),
            port=int(os.getenv("PGPORT", "5432")),
            user=user,
            password=password,
            connect_timeout=3,
        ) as conn:
            with conn.cursor(row_factory=tuple_row) as cur:
                cur.execute(
                    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1;"
                )
                return [r[0] for r in cur.fetchall()]
    except Exception:
        return None


def main() -> int:
    candidates = [
        (os.getenv("PGUSER", "postgres"), os.getenv("PGPASSWORD")),
        ("postgres", None),
        ("postgres", "postgres"),
    ]
    for user, password in candidates:
        result = try_connect(user, password)
        if result is not None:
            print("\n".join(result))
            return 0
    print("ERROR: Could not connect to PostgreSQL at 127.0.0.1:5432. Set PGUSER/PGPASSWORD or provide credentials.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

