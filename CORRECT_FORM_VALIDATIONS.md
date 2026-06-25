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
* **Order Date**: Date (DD-MM-YYYY, Required)
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

The Vehicle Number, Vehile Type & Transporter is the only fields that is required to insert the order. Rest of the fields can be filed before the order is dispatched but all fields will be required to successfully dispatch the order.

## 4. In-Plant Usage Form (Manual Diesel Entry)
* **Date**: Date (DD-MM-YYYY, Required)
* **Vehicle Number**: String (Required)
* **Site / Location**: String (Required)
* **Purpose**: String (Required)
* **Operator / Issued To**: String (Required)
* **HSD (Liters)**: Number (Required)
* **KM / Hrs**: Number (Optional)

## 5. Diesel Intake Form
* **Date**: Date (DD-MM-YYYY, Required)
* **Liters**: Number (Decimal, Required)
* **Remarks**: String (Optional)

## 6. Raw Material Stock Form (Inline Table Edit)
* **Date**: Date (DD-MM-YYYY)
* **Material Category / Item**: String
* **Receipt**: Number (Any type of number, Optional/Zero default)
* **Issue**: Number (Any type of number, Optional/Zero default)
* **Remarks**: String (Optional)

## 7. Finished Stock Report Form (Inline Table Edit)
* **Date**: Date (DD-MM-YYYY)
* **Add Size**: String (Optional)
* **Remove Size**: String (Optional)
* **Segregation**: Number (Any type of Number, Optional/Zero default)
* **Sale**: Number (Any type of Number, Optional/Zero default)
* **Pro Rej. (Production Rejection)**: Number (Any type of Number, Optional/Zero default)
* **Load Rej. (Loading Rejection)**: Number (Any type of Number, Optional/Zero default)
* **Self Use**: Number (Any type of Number, Optional/Zero default)
* **Self Use (BJM)**: Number (Any type of Number, Optional/Zero default)
* **In Autoclave**: Number (Any type of Number, Optional/Zero default)
* **Mortar (Bag) Receipt**: Number (Any type of Number, Optional/Zero default)
* **Mortar (Bag) Sale**: Number (Any type of Number, Optional/Zero default)
* **Total Sale (CBM)**: Number (Any type of Number, Calculated/Read-only)
* **Total Mortar Sale (BAGS)**: Number (Any type of Number, Calculated/Read-only)
* **Total Production (CBM)**: Number (Any type of Number, Calculated/Read-only)

## 8. Loading & Unloading Report Form (Inline Table Edit)
* **Date**: Date (DD-MM-YYYY)
* **Client**: String
* **Vehicle**: String
* **Type**: String
* **GS**: Boolean (Checkbox)
* **Loading By**: String (Optional)
* **Load Rate**: Number (Any type of Number, Optional)
* **Unloading By**: String (Optional)
* **Unload Rate**: Number (Any type of Number, Optional)
* **Remarks**: String (Optional)

## 9. Detailed Sales Report Form (Inline Table Edit)
* **Date**: Date (DD-MM-YYYY)
* **Invoice ID**: String
* **Client**: String
* **Site**: String
* **CBM**: Number (Any type of Number)
* **BJM**: Number (Any type of Number)
* **BJM Rate**: Number (Any type of Number)
* **Vehicle**: String
* **Type**: String
* **Transporter**: String
* **Net Wt**: Number (Any type of Number)
* **Loading**: String
* **L. Rate**: Number (Any type of Number)
* **Unloading**: String
* **U. Rate**: Number (Any type of Number)
* **GS**: Boolean (Checkbox)
* **Ref**: String

## 10. Diesel Usage Register Form (Inline Table Edit)
* **Date**: Date (DD-MM-YYYY)
* **Vehicle Number**: String
* **Client / Machine**: String
* **Loc / Site**: String
* **Operator / Issued To**: String
* **Purpose**: String
* **KM / Hrs**: Number (Decimal)
* **HSD (L)**: Number (Decimal)


I already have some data in the backend which might follow the previously used form setup like YYYY-MM-DD but can you safely switch to DD-MM-YYYY? Without breaking that? And ensuring that all future entires will have this setup? Or maybe do something to fix the previous entires as well?