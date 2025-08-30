# Tech Debt: Fix monitoring.tf invalid references

Context
- The Terraform plan failed due to `monitoring.tf` referencing undeclared resources and variables in the root module (e.g., `aws_lambda_function.reminder_function`, `aws_sns_topic.appointment_reminders`, `aws_cloudwatch_log_group.*`, and `var.alert_email`).
- This blocks `terraform plan` runs unless the file is disabled.

Impact
- Prevents infrastructure validation and planning in environments where the referenced resources are not defined in the same module.
- Increases risk of drift and slows CI/CD.

Required Fixes
- Option A (module split): Move monitoring resources into a dedicated module that is only included in environments where these dependencies exist; pass required ARNs and names as inputs.
- Option B (conditional resources): Add toggle variable (e.g., `enable_monitoring`) with `count` or `for_each` guards; wire variables for all external ARNs and names (`reminder_function_name`, `appointment_reminders_topic_name`, `booking_log_group_name`, `reminder_log_group_name`, `sms_opt_out_log_group_name`, `alert_email`).
- Option C (data lookups): Resolve resource names dynamically using `data` sources (e.g., `data.aws_lambda_function`, `data.aws_cloudwatch_log_group`, `data.aws_sns_topic`) to avoid direct resource references.

Acceptance Criteria
- `terraform plan` succeeds without manual file renaming.
- All references in `monitoring.tf` come from variables or data sources, not undeclared resources.
- CI includes a plan step that runs cleanly.

Notes
- While executing a security hotfix (RDS password secret), monitoring was temporarily disabled to obtain a clean plan and immediately restored.
