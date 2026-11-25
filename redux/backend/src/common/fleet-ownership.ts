export function ownsFleetAssignment(assignment: {fleetManagerId?: string}, managerId: string): boolean {
  return Boolean(managerId) && assignment.fleetManagerId === managerId;
}

export function ownsDriverAssignment(assignment: {driverId?: string}, driverId: string): boolean {
  return Boolean(driverId) && assignment.driverId === driverId;
}
