"""
EC2EZ Interactive Module
Post-exploitation interactive menu
"""

import subprocess
from .utils import log_info, log_separator, log, has_permission
from .aws import list_s3_buckets, list_iam_users, list_iam_roles, list_ec2_instances
from .config import COLORS


def run_interactive_menu(permissions):
    """Run interactive menu based on discovered permissions"""
    discovered = permissions.get('permissions', [])

    log_separator()
    log(f"{COLORS.BRIGHT}INTERACTIVE MENU{COLORS.RESET}", color="cyan")
    log_info("Available actions based on discovered permissions\n")

    while True:
        options = build_menu_options(discovered)

        # Display menu
        for key, option in options.items():
            log(f"  {key}. {option['label']}")

        log("\n  0. Exit")

        choice = input(f"\n{COLORS.CYAN}Select an option: {COLORS.RESET}").strip()

        if choice == '0':
            log_info("Exiting...")
            break

        if choice in options:
            log_separator()
            options[choice]['action']()
            log_separator()
        else:
            log("Invalid option", color="yellow")


def build_menu_options(permissions):
    """Build menu options based on available permissions"""
    options = {}
    counter = 1

    if has_permission('s3:ListAllMyBuckets', permissions):
        options[str(counter)] = {'label': 'List S3 Buckets', 'action': list_s3_buckets}
        counter += 1

    if has_permission('iam:ListUsers', permissions):
        options[str(counter)] = {'label': 'List IAM Users', 'action': list_iam_users}
        counter += 1

    if has_permission('iam:ListRoles', permissions):
        options[str(counter)] = {'label': 'List IAM Roles', 'action': list_iam_roles}
        counter += 1

    if has_permission('ec2:DescribeInstances', permissions):
        options[str(counter)] = {'label': 'List EC2 Instances', 'action': list_ec2_instances}
        counter += 1

    # Shell command always available
    options[str(counter)] = {'label': 'Run Shell Command', 'action': run_shell_command}

    return options


def run_shell_command():
    """Execute arbitrary shell command"""
    command = input(f"{COLORS.CYAN}Enter command: {COLORS.RESET}").strip()

    if not command:
        log("No command entered", color="yellow")
        return

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.stdout:
            log("\nOutput:", color="green")
            print(result.stdout)

        if result.stderr:
            log("\nError:", color="red")
            print(result.stderr)

    except subprocess.TimeoutExpired:
        log("Command timed out", color="red")
    except Exception as e:
        log(f"Command failed: {str(e)}", color="red")
