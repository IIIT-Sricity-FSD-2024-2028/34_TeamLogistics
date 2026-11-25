import { onShift, rankDrivers, trackPosition } from './dispatch';
import { operationalPage } from './page';
import { fitsVehicle } from './vehicle-capacity';

const fixed = Date.parse('2026-05-01T18:30:00Z');
const point = {latitude: 12, longitude: 80};
describe('dispatch and tracking', () => {
  it('handles overnight shifts in Indian local time', () => {
    const shifts = {a: {start:'22:00', end:'06:00'}};
    expect(onShift('a', new Date(fixed), shifts)).toBe(true);
    expect(onShift('a', new Date(fixed + 6 * 3600000), shifts)).toBe(false);
  });
  it('ranks using fresh, accurate samples before workload and preserves the source list', () => {
    const drivers: any[] = [{id:'a'}, {id:'b'}];
    const history: any[] = [{driverId:'b',lastPosition:{...point,accuracy:10,recordedAt:new Date(fixed).toISOString()}}];
    expect(rankDrivers(drivers, history, point, fixed)[0].id).toBe('b');
    expect(rankDrivers(drivers, history, point, fixed+61000)[0].id).toBe('a');
    expect(drivers[0].id).toBe('a');
  });
  it('uses measurement time for retries and ignores old or implausible samples', () => {
    const route = {id:'depot',label:'Depot',km:5,dropPoint:point,arrivalRadiusM:100};
    const sample = trackPosition({...point, accuracy:5}, undefined, route, fixed);
    expect(sample.nearDrop).toBe(true);
    expect(trackPosition({...point, measuredAt:sample.measuredAt}, sample, route, fixed+1000)).toBe(sample);
    expect(() => trackPosition({...point,longitude:70},sample,route,fixed+1000)).toThrow('movement');
    expect(() => trackPosition({...point,measuredAt:sample.measuredAt},undefined,route,fixed+610000)).toThrow('fresh');
  });
  it('checks cargo bay rotation, refrigerated handling and route together', () => {
    const vehicle: any = {capacity:'1 t',cargoCm:[200,120,100],handling:['Refrigerated','Food'],routeIds:['local']};
    const cargo = {weight:500,packageDimensions:{length:110,width:190,height:90},packageType:'Food',refrigerated:true,routeId:'local'};
    expect(fitsVehicle(vehicle,cargo)).toBe(true);
    expect(fitsVehicle(vehicle,{...cargo,routeId:'other'})).toBe(false);
    expect(fitsVehicle(vehicle,{...cargo,packageType:'Hazardous Goods'})).toBe(false);
    expect(fitsVehicle(vehicle,{...cargo,packageDimensions:{length:110,width:190,height:105}})).toBe(false);
    expect(fitsVehicle({...vehicle,handling:['Food']},cargo)).toBe(false);
  });
  it('returns only the requested page and counts statuses across fifty thousand trips', () => {
    const rows = Array.from({length:50000},(_,i)=>({id:'T'+i,driver:'Driver',status:i%2?'Assigned':'Completed'}));
    const page = operationalPage(rows,{view:'driver-open',page:1000,limit:10});
    expect(page.totalItems).toBe(25000);
    expect(page.items).toHaveLength(10);
    expect(page.statusCounts.completed).toBe(25000);
  });
});
