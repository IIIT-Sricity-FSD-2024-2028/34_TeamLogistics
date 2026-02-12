# Summary of Interaction :
The interaction with the domain expert helped the team understand real‑world logistics and delivery operations. We learned the key domain terminology used in practice and identified the main actors involved along with their responsibilities. The expert explained the end‑to‑end delivery workflow, from order creation and warehouse preparation to delivery execution and customer confirmation.
We also discussed about our use case diagram.The discussion also highlighted important rules, constraints, and common exceptions such as driver working hours, vehicle availability, SLA commitments, and delivery failures. Overall, the interaction confirmed that the identified problem exists in practice and validated the need for a Fleet & Driver Operations Management System.

## Basic information
    Domain: Logistics and Delivery Operations
    Problem statement:Fleet and Drivers operations Management System
    Date of interaction: 31/01/2026
    Mode of interaction: video call
    Duration (in-minutes): 58 mins
    Publicly Accessible Video Link:  
[Domain Expert Interaction Video](https://drive.google.com/drive/folders/1aITaFD8dDeIqHo3TujgSRnrXr_qze0kA?usp=sharing)
    
## Domain Expert Details
    Role/ designation : Backend Developer in Delhivery app
    Experience in the domain : Backend in Logistics and 1 Year of Experience
    Nature of work: Developer

## Domain Context and Terminology

### Q1. How would you describe the overall purpose of this problem statement in your daily work?

**Answer:**  
In daily logistics operations, the purpose of this problem statement is to coordinate and control delivery execution by bringing together orders, drivers, vehicles, and routes into a single, consistent workflow.  
It helps operational teams avoid manual coordination, reduce confusion between roles, and ensure that deliveries are executed smoothly from dispatch to customer confirmation.

---

### Q2. What are the primary goals or outcomes of this problem statement?

**Answer:**  
The main goals of this problem statement are to:
- Ensure timely and reliable delivery execution  
- Improve coordination between warehouse, dispatcher, fleet manager, and drivers  
- Maintain driver compliance and vehicle availability  
- Provide real-time visibility into delivery status  
- Handle exceptions and delays efficiently  
- Improve overall customer satisfaction  

### Q3. List key terms used by the domain expert and their meanings.

**Answer:**  
| Term | Meaning as explained by the domain expert |
|------|-------------------------------------------|
| Delivery Order | A request created in the system to transport a shipment from a source location to a customer within a defined delivery time window |
| Bulk Order | A single request containing multiple delivery orders that need to be planned and executed together |
| Shipment | A physical package or set of items prepared for delivery |
| Dispatch | The process of assigning delivery orders to drivers and vehicles and initiating delivery |
| Fleet | A group of vehicles managed by the organization for transportation and delivery |
| Vehicle | A transport unit such as a bike, van, or truck used to carry shipments |
| Driver | A person responsible for transporting shipments and completing deliveries |
| Driver Compliance | Verification that a driver meets all regulatory and company requirements such as license validity and working hours |
| Fleet Manager | A role responsible for managing vehicles and drivers, assigning deliveries, and monitoring operations |
| Admin | A role responsible for managing users, system configuration, and overall platform control |
| Route Plan | A planned path followed by a driver to complete deliveries efficiently |
| Delivery Status | The current stage of a delivery order in its lifecycle |
| Proof of Delivery (POD) | Evidence confirming successful delivery, such as signature or photo |
| Incident | An unexpected event that delays or prevents delivery |
| Exception Handling | The process of resolving delivery issues through reassignment or escalation |
| SLA (Service Level Agreement) | A defined delivery time or quality commitment agreed with the client |
| ETA (Estimated Time of Arrival) | The predicted time when the delivery will reach the customer |
| Automation Engine | A system component that automatically monitors, assigns, and optimizes deliveries based on rules |
| Compliance Monitoring | Continuous tracking of driver and vehicle compliance status |
| Live Tracking | Real‑time location sharing of drivers during delivery execution |


## Actors and Responsibilities

| Actor / Role | Responsibilities |
|--------------|------------------|
| Admin | Manages system users, roles, permissions, system settings, and ensures overall system operation and data integrity |
| Business Client | Creates and manages delivery requests, tracks shipment progress, monitors service performance, and reviews delivery reports |
| Fleet Manager | Manages vehicles and drivers, assigns deliveries, monitors fleet availability, tracks trip progress, and ensures compliance and maintenance readiness |
| Driver | Executes deliveries, follows assigned routes and schedules, updates trip status, shares live location, and confirms delivery through proof of delivery |

## Core workflows

### Workflow 1: Vehicle Maintenance & Availability Management

**Trigger / Start Condition:**  
A vehicle reaches its service limit or reports a maintenance issue.

**Steps Involved :**
1. Fleet Manager reviews vehicle usage and service alerts.
2. Vehicle is marked as unavailable for delivery.
3. Maintenance is scheduled.
4. Vehicle is serviced and inspected.
5. Vehicle is marked available for operations.

**Outcome / End Condition:**  
The vehicle is restored to service or remains unavailable until issues are resolved.

---

### Workflow 2: Delivery Order Creation & Dispatch

**Trigger / Start Condition:**  
A business client creates a new delivery request.

**Steps Involved :**
- Business Client submits delivery order details  
- System validates order information and SLA  
- Delivery order is added to the pending queue  
- Fleet Manager reviews incoming delivery requests  
- Order is approved and moved to dispatch planning  

**Outcome / End Condition:**  
The delivery order is ready for assignment to a driver and vehicle.

---

### Workflow 3: Delivery Execution & Confirmation

**Trigger / Start Condition:**  
A driver is assigned a delivery order.

**Steps Involved :**
1. Driver accepts the assigned delivery.
2. Driver picks up the shipment from the warehouse.
3. Driver follows the planned route to the customer.
4. Driver delivers the shipment.
5. Driver submits proof of delivery (OTP, signature, or photo).

**Outcome / End Condition:**  
The delivery is successfully completed and confirmed by the customer.

## Rules, Constraints, and Exceptions

### Mandatory Rules or Policies
- Drivers must have valid licenses and mandatory documents before assignment.
- Drivers must follow defined working hour limits.
- Vehicles must be operational and approved before being assigned.
- Deliveries must comply with agreed Service Level Agreements (SLAs).
- Proof of Delivery must be recorded for completed deliveries.

---

### Constraints or Limitations
- Availability of drivers and vehicles may be limited during peak demand.
- Route planning is affected by distance, traffic, and delivery priority.
- Vehicle capacity limits the number of shipments per trip.
- Deliveries depend on customer availability at the destination.

---

### Common Exceptions or Edge Cases
- Vehicle breakdown during delivery.
- Customer not available at delivery location.
- Incorrect or incomplete delivery address.
- Delivery delays due to traffic or weather conditions.

---

### Situations Where Things Usually Go Wrong
- Delayed communication between drivers and dispatchers.
- Late detection of driver or vehicle unavailability.
- Delays in updating delivery status in the system.
- Improper handling of delivery exceptions.

## Current Challenges and Pain Points

### Most Difficult or Inefficient Parts
- Coordinating activities between fleet manager and drivers.
- Managing delivery assignments when drivers or vehicles become unavailable suddenly.
- Handling delivery exceptions in real time without manual follow‑ups.

---

### Where Delays, Errors, or Misunderstandings Occur
- Late communication of vehicle breakdowns or driver issues.
- Delays in updating delivery status during execution.
- Incorrect or incomplete delivery addresses.
- Route plans not matching real‑time traffic conditions.

---

### Information Hardest to Track or Manage Today
- Real‑time driver availability and working hours.
- Vehicle availability and maintenance status.
- Accurate delivery progress during execution.
- Timely visibility into delivery failures or delays.

## Assumptions & Clarifications

### Assumptions Confirmed
- Delivery operations involve multiple roles and require strong coordination.
- Driver availability and compliance directly impact delivery success.
- Vehicle availability and maintenance status affect delivery planning.
- A unified system can reduce delays and miscommunication in operations.

---

### Assumptions Corrected
- Route planning is not static and often needs real‑time adjustments.
- Delivery exceptions occur frequently and must be handled as part of normal operations.

---

### Open Questions That Need Follow‑Up
- How frequently should delivery routes be re‑optimized during execution?
- What level of automation is ideal for handling delivery exceptions?
- How can real‑time accuracy of driver and vehicle status be improved?







