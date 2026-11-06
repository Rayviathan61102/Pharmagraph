"""Start PharmaGraph with:  python -m server"""
import uvicorn

HOST = "127.0.0.1"  # this computer only: other devices on the network cannot connect
PORT = 8000

if __name__ == "__main__":
    print(f"PharmaGraph running at http://{HOST}:{PORT}   (HTTP API test page: /docs)")
    uvicorn.run("server.app:app", host=HOST, port=PORT)
