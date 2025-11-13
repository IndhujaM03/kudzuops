import os
import importlib
import pkgutil
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# -----------------------------
# Load .env from backend folder
# -----------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")  # backend/.env
load_dotenv(dotenv_path=dotenv_path, override=True)

# -----------------------------
# Dynamic Router Discovery
# -----------------------------
def discover_routers():
    """
    Automatically discover and import all router modules in the app directory.
    This eliminates the need to manually add each router to main.py
    """
    routers = []
    app_dir = Path(__file__).parent
    
    print("🔍 Discovering routers...")
    
    # Get all Python files in the app directory
    for file_path in app_dir.glob("*.py"):
        if file_path.name == "__init__.py" or file_path.name == "main.py":
            continue
            
        module_name = file_path.stem
        print(f"  📁 Checking module: {module_name}")
        
        try:
            # Import the module using the correct path
            module = importlib.import_module(f".{module_name}", package="app")
            
            # Look for router objects in the module
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                
                # Check if it's a FastAPI router
                if hasattr(attr, 'routes') and hasattr(attr, 'prefix'):
                    print(f"    ✅ Found router: {attr_name} (prefix: {getattr(attr, 'prefix', 'None')})")
                    routers.append({
                        'router': attr,
                        'name': attr_name,
                        'module': module_name,
                        'prefix': getattr(attr, 'prefix', None)
                    })
                        
        except Exception as e:
            print(f"    ⚠️  Could not import {module_name}: {e}")
            continue
    
    # Also scan the routes subdirectory
    routes_dir = app_dir / "routes"
    if routes_dir.exists():
        print("🔍 Scanning routes/ subdirectory...")
        for file_path in routes_dir.glob("*.py"):
            if file_path.name == "__init__.py":
                continue
                
            module_name = file_path.stem
            print(f"  📁 Checking routes module: {module_name}")
            
            try:
                # Import the module using the correct path
                module = importlib.import_module(f".routes.{module_name}", package="app")
                
                # Look for router objects in the module
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    
                    # Check if it's a FastAPI router
                    if hasattr(attr, 'routes') and hasattr(attr, 'prefix'):
                        print(f"    ✅ Found router: {attr_name} (prefix: {getattr(attr, 'prefix', 'None')})")
                        routers.append({
                            'router': attr,
                            'name': attr_name,
                            'module': f"routes.{module_name}",
                            'prefix': getattr(attr, 'prefix', None)
                        })
                            
            except Exception as e:
                print(f"    ⚠️  Could not import routes.{module_name}: {e}")
                continue
    
    print(f"🎯 Total routers discovered: {len(routers)}")
    return routers

# -----------------------------
# FastAPI App Factory
# -----------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title="Kudzu Recruitment Platform", 
        version="0.1.0",
        description="Automated FastAPI application with dynamic router discovery"
    )

    # CORS Configuration
    allowed_origins = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "https://kudzuops.nouvelledynamics.com",
        "http://kudzuops.nouvelledynamics.com",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -----------------------------
    # Dynamic Router Inclusion
    # -----------------------------
    print("🚀 Starting automated router inclusion...")
    discovered_routers = discover_routers()
    
    # Automatically sort routers by route specificity
    # Routers with more specific routes (no path parameters) get higher priority
    def analyze_router_specificity(router_info):
        """Analyze routes to determine their specificity"""
        router = router_info['router']
        if not hasattr(router, 'routes'):
            return 0
        
        # Count routes with and without path parameters
        specific_count = 0  # routes without {param}
        catchall_count = 0  # routes with {param}
        
        for route in router.routes:
            if hasattr(route, 'path'):
                path = route.path
                # Check if path has parameters
                if '{' in path and '}' in path:
                    catchall_count += 1
                elif path and path != '/':
                    specific_count += 1
        
        # Routers with only specific routes get priority 0 (highest)
        # Routers with catchall routes get priority 1 (lower)
        # Mixed routers get priority 0.5
        if catchall_count == 0:
            return 0  # All specific routes - highest priority
        elif specific_count == 0:
            return 1  # All catchall routes - lowest priority
        else:
            # Mixed: prioritize by ratio of specific to total
            return 1 - (specific_count / (specific_count + catchall_count))
    
    sorted_routers = sorted(discovered_routers, key=analyze_router_specificity)
    
    for router_info in sorted_routers:
        router = router_info['router']
        name = router_info['name']
        module = router_info['module']
        prefix = router_info['prefix']
        
        try:
            # Include the router
            app.include_router(router)
            print(f"✅ Included router: {name} from {module}.py")
        except Exception as e:
            print(f"❌ Failed to include router {name}: {e}")

    # -----------------------------
    # Static Files Mounting
    # -----------------------------
    cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
    if os.path.exists(cv_uploads_path):
        app.mount("/cv-files", StaticFiles(directory=cv_uploads_path), name="cv-files")
        print(f"📁 CV uploads directory mounted: {cv_uploads_path}")
    else:
        print(f"⚠️  CV uploads directory not found: {cv_uploads_path}")
        # Try alternative path
        alt_path = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "cv_uploads")
        if os.path.exists(alt_path):
            app.mount("/cv-files", StaticFiles(directory=alt_path), name="cv-files")
            print(f"📁 CV uploads directory mounted (alt): {alt_path}")
        else:
            print(f"⚠️  Alternative CV uploads directory not found: {alt_path}")

    # -----------------------------
    # Built-in Routes
    # -----------------------------
    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok", 
            "message": "Kudzu Operations Backend",
            "automated": True,
            "routers_discovered": len(discovered_routers)
        }

    @app.get("/api/info")
    async def api_info() -> dict:
        """Get information about discovered routers and endpoints"""
        router_info = []
        for router_data in discovered_routers:
            router_info.append({
                "name": router_data['name'],
                "module": router_data['module'],
                "prefix": router_data['prefix'],
                "routes_count": len(router_data['router'].routes) if hasattr(router_data['router'], 'routes') else 0
            })
        
        return {
            "total_routers": len(discovered_routers),
            "routers": router_info,
            "automated_discovery": True
        }

    print("🎉 FastAPI application created successfully!")
    print(f"📊 Total routers included: {len(discovered_routers)}")
    
    return app

# -----------------------------
# Create app instance
# -----------------------------
app = create_app()

# -----------------------------
# Startup Event (Optional)
# -----------------------------
@app.on_event("startup")
async def startup_event():
    print("🚀 Kudzu Operations Backend started!")
    print("🔧 Automated router discovery enabled")
    print("📡 All endpoints are dynamically discovered and registered")