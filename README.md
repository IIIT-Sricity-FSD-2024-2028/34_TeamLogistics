# 34_TeamLogistics
# Domain : Logistics and Delivery Operations.
# Problem Statement : Fleet and Driver Operations Management System.

## Problem Statement Explanation

The Fleet and Driver Operations Management System is built to improve how logistics and delivery operations are handled. It helps manage vehicles, drivers, shipments, and delivery processes in one centralized system.

In many logistics companies, tasks like assigning drivers, tracking vehicles, preparing shipments, checking compliance, and confirming deliveries are often done manually or using different systems. This usually causes delays, mistakes, poor tracking visibility, and compliance issues.

This system helps solve these problems by providing:

- Centralized management of fleet vehicles and drivers  
- Automated delivery planning and dispatch process  
- Real-time delivery tracking and monitoring  
- Driver and vehicle compliance validation  
- Better coordination between warehouse and dispatch teams  
- Customer delivery tracking and confirmation  
- Support for handling delivery delays, incidents, and reassignment  

### Primary Goal

The main goal is to create a smooth end-to-end logistics workflow from order dispatch to final delivery confirmation while improving efficiency and reducing manual work.


## Identified Actors
The system involves the following actors:

1. Admin  
2. Fleet Manager  
3. Warehouse Operator  
4. Dispatcher  
5. Driver  
6. Customer

## Planned Features for Each Actor :-

1.Admin : 
Responsible for system setup and overall configuration.
- Manage users (create, update, deactivate accounts)
- Assign roles and permissions
- Manage master data (vehicle types, zones, package types)
- Configure system rules (driver working hours, SLA limits)
- Monitor system access and security.
  
2.Fleet Manager :
Responsible for managing vehicles and driver compliance.
- Manage fleet vehicles (add, update, allocate, block vehicles)
- Schedule and track vehicle maintenance
- Monitor driver compliance (license validity, working hours, documents)
- Track fuel usage and vehicle mileage
- View fleet performance analytics

3.Dispatcher :
Responsible for planning and controlling delivery operations.
- Create delivery orders (single and bulk upload)
- Assign deliveries to drivers and vehicles
- Plan optimal delivery routes
- Reassign deliveries when exceptions occur
- Handle delivery exceptions and escalations

4. Warehouse Operator :
Responsible for preparing shipments for delivery.
- Prepare shipment (picking, labeling, verification, packing)
- Update shipment status as ready for dispatch
- Handover packages to drivers
- Report shipment issues or mismatches

5.Driver :
Responsible for executing deliveries.
- Manage work shift (check‑in and check‑out)
- Accept or reject assigned delivery tasks
- Execute delivery and update delivery status
- Submit proof of delivery (OTP, signature, photo)
- Report incidents or delivery issues

6.Customer :
Responsible for tracking and confirming deliveries.
- Track delivery status and location
- Confirm delivery using OTP or confirmation
- Provide feedback.

