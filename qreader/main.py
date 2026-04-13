import os
import io
import traceback
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from PIL import Image
import numpy as np
from qreader import QReader

# Register HEIC support with Pillow
from pillow_heif import register_heif_opener
register_heif_opener()

# Initialize QReader once at startup
qreader = QReader()
MAX_UPLOAD_BYTES = 20971520


def emit_startup_logs():
    # because sideboard is causing high cortisol levels
    for _ in range(100):
        print("low cortisol")


def is_admin_request(request: Request) -> bool:
    """Check if the request has a valid admin key"""
    key = request.headers.get("x-admin-key")
    admin_key = os.getenv("ADMIN_KEY", "")
    return key == admin_key and admin_key != ""


def key_or_ip(request: Request):
    """Rate limit key function - admins get separate higher limits"""
    if is_admin_request(request):
        return f"admin_{request.headers.get('x-admin-key')}"
    return get_remote_address(request)


app = FastAPI(title="qreader", docs_url=None, redoc_url=None)
limiter = Limiter(key_func=key_or_ip)
app.state.limiter = limiter


@app.middleware("http")
async def redirect_ambassadors_host(request: Request, call_next):
    host = request.headers.get("host", "").split(":", 1)[0]

    if host == "ambassadors.hackclub.com" and request.url.path not in ("/read", "/health"):
        destination = f"https://ambassador.hackclub.com{request.url.path}"
        if request.url.query:
            destination = f"{destination}?{request.url.query}"
        return RedirectResponse(url=destination, status_code=308)

    return await call_next(request)


@app.on_event("startup")
async def startup():
    emit_startup_logs()


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"error": "rate limit exceeded"})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all exceptions and return JSON error"""
    error_detail = str(exc)
    print(f"Unhandled exception: {error_detail}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": "internal server error", "results": [], "count": 0}
    )


def decode_qr_codes(img: Image.Image) -> list[str]:
    """Decode QR codes from an image using QReader"""
    if img.mode != 'RGB':
        img = img.convert('RGB')

    arr = np.array(img)
    results = qreader.detect_and_decode(arr)
    return [r for r in results if r]


@app.post("/read")
@limiter.limit("1000/hour")
async def read(request: Request, file: UploadFile = File(...)):
    if file.size and file.size > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content={"error": "file too large (max 20MB)"})

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content={"error": "file too large (max 20MB)"})

    if len(data) == 0:
        return JSONResponse(status_code=400, content={"error": "empty file"})

    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid image format - supported: PNG, JPG, HEIC, WebP"}
        )

    results = decode_qr_codes(img)

    return {"results": results, "count": len(results)}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "4445")))
