-- create a database 
CREATE DATABASE DeliverSync;
-- use the database 
USE DeliverSync;
-- create the tables
-- create the role table
CREATE TABLE Role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);
-- create the Users table   
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY, 
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL, 
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES Role(role_id)
);
-- create the fleet Manager table
CREATE TABLE Fleet_Manager (
    fleet_manager_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_name VARCHAR(120) NOT NULL,
    company_address TEXT,
    number_of_vehicles INT CHECK (number_of_vehicles >= 0),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
-- create the Vehicle table
CREATE TABLE Vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    fleet_manager_id INT,
    vehicle_number VARCHAR(30) UNIQUE NOT NULL,
    vehicle_company VARCHAR(100),
    model VARCHAR(100),
    year INT CHECK (year >= 2000),
    color VARCHAR(50),
    type VARCHAR(50),
    FOREIGN KEY (fleet_manager_id) REFERENCES Fleet_Manager(fleet_manager_id) ON DELETE CASCADE
);
-- create the Driver table
CREATE TABLE Driver (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
    status ENUM('Active','Inactive','Suspended') DEFAULT 'Active',
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
-- create the Business_client table
CREATE TABLE Business_Client (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_name VARCHAR(120) NOT NULL,
    company_address TEXT NOT NULL,
    company_contact_num VARCHAR(15) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
-- create the Delivery_Request table
CREATE TABLE Delivery_Request (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    pickup_location TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    package_details TEXT,
    delivery_type VARCHAR(50),
    request_status ENUM('Pending','Assigned','Completed','Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (client_id) REFERENCES Business_Client(client_id) ON DELETE CASCADE
);
-- create the Assignment table
CREATE TABLE Assignment (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    fleet_manager_id INT,
    request_id INT NOT NULL,
    driver_id INT,
    vehicle_id INT,
    assignment_status ENUM('Assigned','In_Progress','Completed','Cancelled') DEFAULT 'Assigned',
    FOREIGN KEY (request_id) REFERENCES Delivery_Request(request_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES Driver(driver_id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (fleet_manager_id) REFERENCES Fleet_Manager(fleet_manager_id) ON DELETE SET NULL
);
-- create the Trip table
CREATE TABLE Trip (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL, 
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    distance DECIMAL(10,2) CHECK (distance >= 0),
    trip_status ENUM('Started','In_Transit','Delivered','Cancelled') DEFAULT 'Started',
    FOREIGN KEY (assignment_id) REFERENCES Assignment(assignment_id) ON DELETE CASCADE
);
-- create the proof_of_Delivery table
CREATE TABLE Proof_of_Delivery (
    trip_id INT PRIMARY KEY,
    delivery_image TEXT,
    customer_signature TEXT,
    delivered_time TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES Trip(trip_id) ON DELETE CASCADE
);
-- create the Invoice table
CREATE TABLE Invoice (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    amount DECIMAL(10,2) CHECK (amount >= 0),
    due_date DATE,
    payment_status ENUM('Pending','Paid','Overdue') DEFAULT 'Pending',
    FOREIGN KEY (request_id) REFERENCES Delivery_Request(request_id) ON DELETE CASCADE
);
-- create the Document table
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT,
    vehicle_id INT,
    document_type VARCHAR(100) NOT NULL,
    expiry_date DATE,
    FOREIGN KEY (driver_id) REFERENCES Driver(driver_id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE SET NULL
);
-- create the Maintenance table
CREATE TABLE Maintenance (
    maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    service_date DATE,
    service_type VARCHAR(100),
    cost DECIMAL(10,2) CHECK (cost >= 0),
    maintenance_status ENUM('Scheduled','In_Service','Completed') DEFAULT 'Scheduled',
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);
-- create the Compliance table
CREATE TABLE Compliance (
    compliance_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    license_status ENUM('Valid','Expired','Suspended') DEFAULT 'Valid',
    expiry_date DATE,
    violations TEXT,
    compliance_status ENUM('Valid','Invalid') DEFAULT 'Valid',
    FOREIGN KEY (driver_id) REFERENCES Driver(driver_id) ON DELETE CASCADE
);
-- create the Notification table
CREATE TABLE Notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Unread','Read') DEFAULT 'Unread',
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

