#!/usr/bin/env python3
"""
Test and fix CV file structure
"""
import os
import shutil

def test_and_fix_cv_structure():
    """Test and fix the CV file structure"""
    print("🔍 Testing CV File Structure")
    print("=" * 40)
    
    # Define paths
    base_path = os.path.dirname(os.path.abspath(__file__))
    cv_uploads_path = os.path.join(base_path, "backend", "src", "assets", "cv_uploads")
    
    print(f"Base path: {base_path}")
    print(f"CV uploads path: {cv_uploads_path}")
    print(f"CV uploads exists: {os.path.exists(cv_uploads_path)}")
    
    # Create directory structure if it doesn't exist
    if not os.path.exists(cv_uploads_path):
        print("📁 Creating CV uploads directory...")
        os.makedirs(cv_uploads_path, exist_ok=True)
        print(f"✅ Created: {cv_uploads_path}")
    
    # Create test directory structure
    test_recruiter_id = "3"
    test_demand_id = "1"
    test_dir = os.path.join(cv_uploads_path, test_recruiter_id, test_demand_id)
    
    if not os.path.exists(test_dir):
        print(f"📁 Creating test directory: {test_dir}")
        os.makedirs(test_dir, exist_ok=True)
        print(f"✅ Created: {test_dir}")
    
    # Check if the sample file exists
    sample_file = "Indhuja M - Exp Resume.pdf"
    sample_file_path = os.path.join(test_dir, sample_file)
    
    print(f"Sample file path: {sample_file_path}")
    print(f"Sample file exists: {os.path.exists(sample_file_path)}")
    
    # Create a dummy PDF file if it doesn't exist
    if not os.path.exists(sample_file_path):
        print("📄 Creating dummy PDF file...")
        # Create a simple text file as a placeholder
        with open(sample_file_path, 'w') as f:
            f.write("This is a dummy CV file for testing purposes.")
        print(f"✅ Created dummy file: {sample_file_path}")
    
    # List directory contents
    print("\n📂 Directory Structure:")
    for root, dirs, files in os.walk(cv_uploads_path):
        level = root.replace(cv_uploads_path, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 2 * (level + 1)
        for file in files:
            print(f"{subindent}{file}")
    
    # Test the file serving path
    print(f"\n🔗 Test URLs:")
    print(f"   Static file: http://localhost:8000/cv-files/{test_recruiter_id}/{test_demand_id}/{sample_file}")
    print(f"   API endpoint: http://localhost:8000/cv-file/{test_recruiter_id}/{test_demand_id}/{sample_file}")
    
    return cv_uploads_path, test_dir, sample_file_path

if __name__ == "__main__":
    test_and_fix_cv_structure()

