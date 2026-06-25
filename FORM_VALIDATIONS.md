# Form Validations & Expected Data Types

This document lists all the forms and interactive table rows across the application, along with the expected data types for each field. This will serve as a reference for implementing strict frontend and backend validations.

## 1. Login Form
* **Username**: String (Required)
* **Password**: String (Required)

## 2. Management Access Form
* **Selected User**: String (User ID selection)
* **Username**: String (Required)
* **New Password**: String (Required)
* **Current Password**: String (Required only if the user is modifying the Management account)

## 3. New Order / Create Loading Plan Form
* **Order Date**: Date (YYYY-MM-DD, Required)
* **Invoice ID / Number**: String (Optional)
* **Client Name**: String (Required)
* **Location (Client Site)**: String (Required)
* **GSTIN**: String (Optional)
* **Vehicle Number**: String (Required, Alphanumeric, uppercase typical)
* **Vehicle Type**: String (Dropdown selection, Required)
* **Transporter**: String (Optional)
* **AAC Size**: String (Dropdown selection, Required)
* **Quantity**: Number (Decimal, Required)
* **Quantity Unit**: String (Dropdown: 'CBM' or 'PCS', Required)
* **Rate (AAC Block)**: Number (Decimal, Required)
* **BJM (Bags)**: Number (Integer, Optional)
* **Rate (BJM)**: Number (Decimal, Optional)
* **Additional Products** (Dynamic Array/List):
  * **Additional AAC Size**: String (Required)
  * **Quantity**: Number (Decimal, Required)
  * **Quantity Unit**: String ('CBM' or 'PCS', Required)
  * **Rate (AAC Block)**: Number (Decimal, Required)

## 4. In-Plant Usage Form (Manual Diesel Entry)
* **Date**: Date (YYYY-MM-DD, Required)
* **Vehicle Number**: String (Required)
* **Site / Location**: String (Required)
* **Purpose**: String (Required)
* **Operator / Issued To**: String (Required)
* **HSD (Liters)**: Number (Decimal, Required)
* **KM / Hrs**: Number (Decimal, Optional)

## 5. Diesel Intake Form
* **Date**: Date (YYYY-MM-DD, Required)
* **Liters**: Number (Decimal, Required)
* **Remarks**: String (Optional)

## 6. Raw Material Stock Form (Inline Table Edit)
* **Date**: Date (YYYY-MM-DD)
* **Material Category / Item**: String (e.g., Cement, Lime, Gypsum, Aluminum)
* **Receipt**: Number (Decimal, Optional/Zero default)
* **Issue**: Number (Decimal, Optional/Zero default)
* **Remarks**: String (Optional)

## 7. Finished Stock Report Form (Inline Table Edit)
* **Date**: Date (YYYY-MM-DD)
* **Add Size**: String (Optional)
* **Remove Size**: String (Optional)
* **Segregation**: Number (Decimal, Optional/Zero default)
* **Sale**: Number (Decimal, Optional/Zero default)
* **Pro Rej. (Production Rejection)**: Number (Decimal, Optional/Zero default)
* **Load Rej. (Loading Rejection)**: Number (Decimal, Optional/Zero default)
* **Self Use**: Number (Decimal, Optional/Zero default)
* **Self Use (BJM)**: Number (Decimal, Optional/Zero default)
* **In Autoclave**: Number (Decimal, Optional/Zero default)
* **Mortar (Bag) Receipt**: Number (Decimal, Optional/Zero default)
* **Mortar (Bag) Sale**: Number (Decimal, Optional/Zero default)
* **Total Sale (CBM)**: Number (Decimal, Calculated/Read-only)
* **Total Mortar Sale (BAGS)**: Number (Decimal, Calculated/Read-only)
* **Total Production (CBM)**: Number (Decimal, Calculated/Read-only)

## 8. Loading & Unloading Report Form (Inline Table Edit)
* **Date**: Date (YYYY-MM-DD)
* **Client**: String
* **Vehicle**: String
* **Type**: String
* **GS**: Boolean (Checkbox)
* **Loading By**: String (Optional)
* **Load Rate**: Number (Decimal, Optional)
* **Unloading By**: String (Optional)
* **Unload Rate**: Number (Decimal, Optional)
* **Remarks**: String (Optional)

## 9. Detailed Sales Report Form (Inline Table Edit)
* **Date**: Date (YYYY-MM-DD)
* **Invoice ID**: String
* **Client**: String
* **Site**: String
* **CBM**: Number (Decimal)
* **BJM**: Number (Decimal)
* **BJM Rate**: Number (Decimal)
* **Vehicle**: String
* **Type**: String
* **Transporter**: String
* **Net Wt**: Number (Decimal)
* **Loading**: String
* **L. Rate**: Number (Decimal)
* **Unloading**: String
* **U. Rate**: Number (Decimal)
* **GS**: Boolean (Checkbox)
* **Ref**: String

## 10. Diesel Usage Register Form (Inline Table Edit)
* **Date**: Date (YYYY-MM-DD)
* **Vehicle Number**: String
* **Client / Machine**: String
* **Loc / Site**: String
* **Operator / Issued To**: String
* **Purpose**: String
* **KM / Hrs**: Number (Decimal)
* **HSD (L)**: Number (Decimal)
