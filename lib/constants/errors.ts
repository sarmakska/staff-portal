// Centralized error messages for consistency across the expense system

export const EXPENSE_ERRORS = {
  // Auth
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  FORBIDDEN: 'Access denied. This action requires admin privileges.',

  // Validation
  INVALID_AMOUNT: 'Amount must be between £0.01 and £1,000,000.',
  INVALID_CURRENCY: 'Invalid currency code. Please select a valid currency.',
  INVALID_DATE: 'Invalid date format. Please select a valid date.',
  INVALID_DESCRIPTION: 'Description must be at least 3 characters long.',
  MISSING_APPROVER: 'Please select an approver for this expense.',
  MISSING_FILE: 'Please upload a receipt file.',
  MISSING_MONTH: 'Month parameter is required.',

  // File Upload
  INVALID_FILE_TYPE: 'Invalid file type. Please upload JPG, PNG, or PDF.',
  FILE_TOO_LARGE: 'File too large. Maximum size is 10MB.',
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',

  // OCR
  OCR_FAILED: 'Could not scan receipt. Please fill the form manually.',
  OCR_NO_DATA: 'No data found in receipt. Please fill manually.',

  // Bank Statements
  STATEMENT_UPLOAD_FAILED: 'Failed to upload bank statement.',
  STATEMENT_PARSE_FAILED: 'Could not parse bank statement. Please check the file format.',

  // General
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const

export const EXPENSE_SUCCESS = {
  EXPENSE_SUBMITTED: 'Expense submitted successfully!',
  EXPENSE_APPROVED: 'Expense approved.',
  EXPENSE_REJECTED: 'Expense rejected.',
  EXPENSE_PAID: 'Expense marked as paid.',
  RECEIPT_SCANNED: 'Receipt scanned — fields auto-filled!',
  STATEMENT_UPLOADED: 'Bank statement uploaded successfully.',
  SETTINGS_UPDATED: 'Settings updated successfully.',
} as const
