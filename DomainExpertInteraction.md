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
| Term | Meaning as explained by the expert |
|------|----------------------------------|
| Delivery Order | A request to transport a shipment from a source location to a customer within a defined time frame. |
| Shipment | A physical package containing one or more items that is prepared, packed, and handed over for delivery. |
| Dispatch | The process of assigning prepared shipments to drivers and vehicles and initiating the delivery journey. |
| Fleet | A collection of vehicles owned or managed by the organization for delivery and transportation purposes. |
| Vehicle | A transport unit such as a bike, van, or truck used to carry shipments. |
| Driver | A person responsible for transporting shipments from the warehouse to the customer and completing deliveries. |
| Driver Compliance | The state in which a driver satisfies all required conditions such as valid license, working hour limits, and mandatory documents. |
| Fleet Manager | A role responsible for managing vehicles, scheduling maintenance, and monitoring driver compliance. |
| Dispatcher | A role responsible for planning deliveries, assigning orders, and managing route execution. |
| Warehouse Operator | A role responsible for preparing shipments through picking, labeling, verification, and packing. |
| Route Plan | A planned path that a driver follows to complete one or more deliveries efficiently. |
| Delivery Status | The current state of a delivery order indicating its progress in the delivery lifecycle. |
| Proof of Delivery | Confirmation that a shipment has been successfully delivered to the customer. |
| Incident | An unexpected event that prevents or delays successful delivery, such as vehicle breakdown or customer unavailability. |
| Exception Handling | The process of managing delivery incidents through reassignment, escalation, or corrective actions. |
| Customer | The recipient of a shipment who can track, confirm, or provide feedback on a delivery. |
| Service Level Agreement (SLA) | A committed time or quality standard within which a delivery is expected to be completed. |
| Estimated Time of Arrival (ETA) | The predicted time at which a shipment is expected to reach the customer. |
| Master Data | Reference information such as vehicle types, service zones, and package categories used across the system. |

## Actors and Responsibilities

| Actor / Role | Responsibilities |
|--------------|------------------|
| Admin | Manages system users, assigns roles and permissions, configures system rules, and maintains master data. |
| Fleet Manager | Manages fleet vehicles, schedules vehicle maintenance, monitors driver compliance, and ensures vehicle availability. |
| Dispatcher | Creates delivery orders, assigns deliveries to drivers and vehicles, plans routes, and handles delivery exceptions. |
| Warehouse Operator | Prepares shipments by picking, labeling, verifying, and packing orders, and marks shipments ready for dispatch. |
| Driver | Executes assigned deliveries, updates delivery status, submits proof of delivery, and reports incidents during delivery. |
| Customer | Tracks delivery status, confirms delivery, and provides feedback or raises delivery-related issues. |

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

### Workflow 2: Delivery Order Creation & Dispatch Planning

**Trigger / Start Condition:**  
A shipment is ready to be delivered from the warehouse.

**Steps Involved :**
1. Dispatcher creates a delivery order (single or bulk).
2. System validates the order details.
3. Warehouse Operator prepares the shipment.
4. Dispatcher assigns the delivery to a driver and vehicle.
5. A route plan is generated for delivery execution.

**Outcome / End Condition:**  
The delivery order is assigned and marked ready for execution.

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
- Coordinating activities between warehouse, dispatcher, fleet manager, and drivers.
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







