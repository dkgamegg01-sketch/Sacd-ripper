import socket
import subprocess
import time
import platform


def ping_host(host: str, timeout_ms: int = 1500) -> tuple[bool, float]:
    """
    Perform a quick ping to the host.
    Returns (success, latency_ms).
    """
    is_win = platform.system().lower() == "windows"
    cmd = ["ping", "-n" if is_win else "-c", "1", "-w" if is_win else "-W", str(timeout_ms), host]
    
    t0 = time.perf_counter()
    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_ms / 1000.0 + 0.5,
            creationflags=subprocess.CREATE_NO_WINDOW if is_win else 0
        )
        latency = (time.perf_counter() - t0) * 1000.0
        return res.returncode == 0, round(latency, 1)
    except Exception:
        return False, 0.0


def test_socket_connection(host: str, port: int = 2002, timeout_sec: float = 2.0) -> tuple[bool, float, str]:
    """
    Test direct TCP connection to the sacd_extract server port (usually 2002).
    Returns (success, latency_ms, error_message).
    """
    t0 = time.perf_counter()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout_sec)
    try:
        s.connect((host, int(port)))
        latency = (time.perf_counter() - t0) * 1000.0
        s.close()
        return True, round(latency, 1), ""
    except socket.timeout:
        return False, 0.0, "Connection timed out"
    except ConnectionRefusedError:
        return False, 0.0, "Connection refused (Player is online, but port is not responding)"
    except Exception as e:
        return False, 0.0, str(e)


def check_player_connection(host: str, port: int = 2002) -> dict:
    """
    Combined check: tests TCP port first (most relevant), falls back to ping if port fails.
    """
    if not host or not host.strip():
        return {
            "success": False,
            "ping_ok": False,
            "port_ok": False,
            "latency_ms": 0,
            "message": "IP address cannot be empty"
        }
    
    host = host.strip()
    port_ok, port_latency, port_err = test_socket_connection(host, port, timeout_sec=2.0)
    if port_ok:
        return {
            "success": True,
            "ping_ok": True,
            "port_ok": True,
            "latency_ms": port_latency,
            "message": f"Player server connected on port {port} ({port_latency} ms)"
        }
    
    # Check if host responds to ping
    ping_ok, ping_latency = ping_host(host, timeout_ms=1500)
    if ping_ok:
        return {
            "success": False,
            "ping_ok": True,
            "port_ok": False,
            "latency_ms": ping_latency,
            "message": f"Device responded to ping ({ping_latency} ms), but SACD server on port {port} is not reachable. (Make sure AutoScript is running on Blu-ray player)"
        }
    
    return {
        "success": False,
        "ping_ok": False,
        "port_ok": False,
        "latency_ms": 0,
        "message": f"Could not reach {host}:{port}. ({port_err or 'Host unreachable'})"
    }
