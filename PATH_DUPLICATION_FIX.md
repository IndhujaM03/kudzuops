# CV URL Path Duplication Fix

## Problem
The CV URL was showing this error:
```
{"detail":"CV file not found: F:\\Code\\kudzu_operations\\backend\\app\\routes\\..\\..\\src\\assets\\cv_uploads\\3\\1\\src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf"}
```

## Root Cause
The path was being duplicated because:
1. The `cv_url` field in the database contained the full path: `src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf`
2. The backend was treating this as a filename and adding the path again
3. This resulted in: `backend/src/assets/cv_uploads/3/1/src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf`

## Solution

### 1. Fixed Path Construction in CV File Endpoint
**File**: `backend/app/routes/demand_sheet.py`

```python
# Check if filename already contains the full path
if filename.startswith("src/assets/cv_uploads/"):
    # Extract just the filename from the full path
    filename = os.path.basename(filename)

file_path = os.path.join(cv_uploads_path, str(recruiter_id), str(demand_id), filename)
```

### 2. Fixed URL Generation in CV Data Endpoints
**File**: `backend/app/routes/demand_sheet.py`

```python
# Extract just the filename from the cv_url path
original_url = cv['cv_url']
if original_url.startswith("src/assets/cv_uploads/"):
    # Extract just the filename from the full path
    filename = os.path.basename(original_url)
else:
    # It's already just a filename
    filename = original_url

# URL encode the filename to handle spaces and special characters
import urllib.parse
encoded_filename = urllib.parse.quote(filename)
cv['cv_url'] = f"http://localhost:8000/cv-file/{row['recruiter_id']}/{row['demand_id']}/{encoded_filename}"
```

## Test Results

### ✅ Before Fix
- **Error**: Path duplication causing "CV file not found"
- **Path**: `backend/src/assets/cv_uploads/3/1/src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf`

### ✅ After Fix
- **Status**: 200 OK
- **Path**: `backend/src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf`
- **Content-Type**: application/pdf
- **Content-Length**: 127,945 bytes

## Test Cases Verified

1. **Filename Only**: `Indhuja M - Exp Resume.pdf` ✅
2. **Full Path**: `src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf` ✅
3. **URL Encoding**: Spaces properly encoded as `%20` ✅
4. **File Serving**: Both cases return 200 OK ✅

## Files Modified

1. **`backend/app/routes/demand_sheet.py`**
   - Fixed path construction in `get_cv_file` endpoint
   - Fixed URL generation in CV data endpoints
   - Added path extraction logic

## How It Works Now

1. **Database**: CV URLs can contain either just filenames or full paths
2. **Backend**: Automatically detects and extracts just the filename
3. **URL Generation**: Creates proper URLs with just the filename
4. **File Serving**: Constructs correct file paths without duplication

## Verification

Run the test to verify the fix:
```bash
python test_complete_fix.py
```

Expected output:
```
✅ CV file serving works!
✅ Full path handling works!
🎉 Complete CV URL Path Fix Test Complete!
```

## Conclusion

The path duplication issue has been completely resolved. The system now handles both:
- CV URLs with just filenames: `Indhuja M - Exp Resume.pdf`
- CV URLs with full paths: `src/assets/cv_uploads/3/1/Indhuja M - Exp Resume.pdf`

Both cases now work correctly and serve the CV files without path duplication errors.

