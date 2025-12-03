"""
EC2EZ Utility Functions
Logging utilities and helper functions
"""

import sys
import time
import re
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from .config import COLORS


def log(message, data=None, color=None):
    """
    Base logging function with optional color and data

    Args:
        message: The message to log
        data: Optional data to display (dict, list, or string)
        color: Optional color code from COLORS class
    """
    color_code = getattr(COLORS, color.upper(), "") if color else ""
    reset = COLORS.RESET if color else ""

    print(f"{color_code}{message}{reset}")

    if data is not None:
        if isinstance(data, dict):
            for key, value in data.items():
                print(f"  {key}: {value}")
        elif isinstance(data, list):
            for item in data:
                print(f"  - {item}")
        else:
            print(f"  {data}")


def log_info(message):
    """Log informational message in cyan"""
    log(f"ℹ {message}", color="cyan")


def log_success(message):
    """Log success message in green"""
    log(f"✓ {message}", color="green")


def log_error(message):
    """Log error message in red"""
    log(f"✗ {message}", color="red")


def log_warning(message):
    """Log warning message in yellow"""
    log(f"⚠ {message}", color="yellow")


def log_danger(message):
    """Log dangerous action in magenta"""
    log(f"🔥 {message}", color="magenta")


def log_separator():
    """Print a separator line"""
    print("-" * 80)


def display_banner():
    """Display the EC2EZ ASCII art banner"""
    banner = f"""{COLORS.CYAN}
    ███████╗ ██████╗██████╗ ███████╗███████╗
    ██╔════╝██╔════╝╚════██╗██╔════╝╚══███╔╝
    █████╗  ██║      █████╔╝█████╗    ███╔╝
    ██╔══╝  ██║     ██╔═══╝ ██╔══╝   ███╔╝
    ███████╗╚██████╗███████╗███████╗███████╗
    ╚══════╝ ╚═════╝╚══════╝╚══════╝╚══════╝

    {COLORS.BRIGHT}AWS IMDSv2 Exploitation Tool{COLORS.RESET}{COLORS.CYAN}
    Version: 1.1.0 (Python Edition)
    {COLORS.RESET}
    {COLORS.YELLOW}⚠️  AUTHORIZED TESTING ONLY ⚠️{COLORS.RESET}
    {COLORS.DIM}This tool is for security testing with written permission.
    Unauthorized access to computer systems is illegal.{COLORS.RESET}
    """
    print(banner)
    log_separator()


def extract_ssrf_param(url):
    """
    Extract SSRF parameter name from URL

    Args:
        url: The URL to analyze

    Returns:
        The parameter name (e.g., 'url', 'target', 'endpoint')
    """
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)

    # Common SSRF parameter names
    common_params = ["url", "target", "endpoint", "uri", "link", "dest", "destination", "redirect"]

    for param in common_params:
        if param in query_params:
            log_info(f"Auto-detected SSRF parameter: {param}")
            return param

    # If URL has query params but none match common names, use the first one
    if query_params:
        first_param = list(query_params.keys())[0]
        log_warning(f"Using first query parameter as SSRF param: {first_param}")
        return first_param

    # Default fallback
    log_warning("No query parameters found, defaulting to 'url'")
    return "url"


def format_timestamp(timestamp=None):
    """
    Format timestamp for display

    Args:
        timestamp: Optional datetime object or ISO string

    Returns:
        Formatted timestamp string
    """
    if timestamp is None:
        timestamp = datetime.now()
    elif isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            return timestamp

    return timestamp.strftime("%Y-%m-%d %H:%M:%S")


def calculate_expiration(expiration_time):
    """
    Calculate time until expiration

    Args:
        expiration_time: ISO format timestamp string

    Returns:
        Human-readable string like "2 hours 15 minutes"
    """
    try:
        exp_dt = datetime.fromisoformat(expiration_time.replace('Z', '+00:00'))
        now = datetime.now(exp_dt.tzinfo)
        delta = exp_dt - now

        if delta.total_seconds() < 0:
            return "EXPIRED"

        hours = delta.seconds // 3600
        minutes = (delta.seconds % 3600) // 60

        if hours > 0:
            return f"{hours} hour{'s' if hours != 1 else ''} {minutes} minute{'s' if minutes != 1 else ''}"
        else:
            return f"{minutes} minute{'s' if minutes != 1 else ''}"
    except Exception:
        return "Unknown"


def sleep(seconds):
    """Sleep for specified seconds"""
    time.sleep(seconds)


def truncate_string(s, max_length=100):
    """
    Truncate string to max length with ellipsis

    Args:
        s: String to truncate
        max_length: Maximum length before truncation

    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[:max_length] + "..."


def parse_arn(arn):
    """
    Parse AWS ARN into components

    Args:
        arn: ARN string like "arn:aws:iam::123456789012:role/MyRole"

    Returns:
        Dict with parsed components
    """
    if not arn or not arn.startswith("arn:"):
        return None

    parts = arn.split(":")
    if len(parts) < 6:
        return None

    return {
        "partition": parts[1],
        "service": parts[2],
        "region": parts[3],
        "account_id": parts[4],
        "resource": ":".join(parts[5:]),
    }


def is_dangerous_permission(permission):
    """
    Check if a permission is considered dangerous

    Args:
        permission: Permission string like "iam:CreateUser"

    Returns:
        Boolean indicating if dangerous
    """
    from .config import CONFIG

    # Exact match
    if permission in CONFIG.DANGEROUS_PERMISSIONS:
        return True

    # Wildcard match (e.g., iam:*, s3:Put*, etc.)
    service = permission.split(":")[0] if ":" in permission else ""
    action = permission.split(":")[1] if ":" in permission else ""

    # Check for wildcards
    if action == "*":
        # Service-wide wildcard is always dangerous
        return True

    # Check if any dangerous permission matches this pattern
    for dangerous in CONFIG.DANGEROUS_PERMISSIONS:
        dangerous_service = dangerous.split(":")[0]
        dangerous_action = dangerous.split(":")[1]

        if service == dangerous_service:
            # Check wildcard matching
            if "*" in action:
                pattern = action.replace("*", ".*")
                if re.match(f"^{pattern}$", dangerous_action):
                    return True

    return False


def has_permission(permission_to_check, discovered_permissions):
    """
    Check if a permission exists in discovered permissions (with wildcard support)

    Args:
        permission_to_check: Permission to look for (e.g., "s3:ListBucket")
        discovered_permissions: List of discovered permissions

    Returns:
        Boolean indicating if permission is available
    """
    if not discovered_permissions:
        return False

    # Exact match
    if permission_to_check in discovered_permissions:
        return True

    service = permission_to_check.split(":")[0] if ":" in permission_to_check else ""
    action = permission_to_check.split(":")[1] if ":" in permission_to_check else ""

    for perm in discovered_permissions:
        perm_service = perm.split(":")[0] if ":" in perm else ""
        perm_action = perm.split(":")[1] if ":" in perm else ""

        # Service-wide wildcard
        if perm_service == service and perm_action == "*":
            return True

        # Action wildcard pattern matching
        if perm_service == service and "*" in perm_action:
            pattern = perm_action.replace("*", ".*")
            if re.match(f"^{pattern}$", action):
                return True

    return False


def detect_credentials_in_text(text):
    """
    Detect potential credentials in text using regex patterns

    Args:
        text: Text to scan for credentials

    Returns:
        List of detected credential patterns with types
    """
    if not text or not isinstance(text, str):
        return []

    findings = []

    patterns = [
        (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
        (r"-----BEGIN[A-Z ]+PRIVATE KEY-----", "Private Key"),
        (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?([^'\"\\s]+)", "Password"),
        (r"(?i)(api[_-]?key|apikey|api[_-]?token)\s*[:=]\s*['\"]?([^'\"\\s]+)", "API Key"),
        (r"(?i)(token|bearer)\s*[:=]\s*['\"]?([^'\"\\s]+)", "Token"),
        (r"https?://[^:]+:([^@]+)@", "URL with Credentials"),
    ]

    for pattern, cred_type in patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            findings.append({
                "type": cred_type,
                "value": match.group(0),
                "position": match.start(),
            })

    return findings


def format_bytes(bytes_count):
    """
    Format bytes into human-readable format

    Args:
        bytes_count: Number of bytes

    Returns:
        Formatted string like "1.5 MB"
    """
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_count < 1024.0:
            return f"{bytes_count:.2f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.2f} PB"


def confirm_action(message):
    """
    Ask user for confirmation

    Args:
        message: Question to ask user

    Returns:
        Boolean indicating user's choice
    """
    response = input(f"{COLORS.YELLOW}{message} (y/n): {COLORS.RESET}").strip().lower()
    return response in ["y", "yes"]
