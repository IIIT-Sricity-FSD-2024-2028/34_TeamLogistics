import { useGetServiceRoutesQuery } from '../../redux/fleetManagerApi';

export const emptyCargo = {cargoCm: ['', '', ''], handling: [], routeIds: []};
export function cargoPayload(cargo) {
  const cargoCm = cargo.cargoCm.map(Number);
  if (cargoCm.some((n) => !Number.isFinite(n) || n < 1 || n > 3000)) return null;
  return {...cargo, cargoCm};
}
export default function CargoFields({value, change}) {
  const routes = useGetServiceRoutesQuery().data || [];
  function toggle(key, item) {
    change({...value, [key]: value[key].includes(item) ? value[key].filter((v) => v !== item) : [...value[key], item]});
  }
  return <fieldset className="field"><legend>Cargo and service area</legend>
    {['Length', 'Width', 'Height'].map((label, i) => <label key={label}>{label} inside cargo area (cm)
      <input type="number" min="1" max="3000" value={value.cargoCm[i]} onChange={(e) => change({...value, cargoCm: value.cargoCm.map((n,j) => j === i ? e.target.value : n)})}/></label>)}
    <p>Approved handling</p>{['Food', 'Medical Supplies', 'Fragile Items', 'Hazardous Goods', 'Refrigerated'].map((item) => <label key={item}><input type="checkbox" checked={value.handling.includes(item)} onChange={() => toggle('handling', item)} />{item}</label>)}
    <p>Service routes (empty covers all routes)</p>{routes.map((r) => <label key={r.id}><input type="checkbox" checked={value.routeIds.includes(r.id)} onChange={() => toggle('routeIds', r.id)} />{r.label}</label>)}
  </fieldset>;
}
