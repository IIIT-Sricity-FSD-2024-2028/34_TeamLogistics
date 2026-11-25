import { useState } from 'react';
import { useGetParcelLabelQuery } from '../../redux/businessClientApi';

// Interleaved 2 of 5 encodes one digit in the bars and the next in the spaces.
const wideElements = ['23', '04', '14', '01', '24', '02', '12', '34', '03', '13'];
function barcodeWidths(digits) {
  const widths = [1, 1, 1, 1];
  for (let pair = 0; pair < digits.length; pair += 2) {
    for (let i = 0; i < 5; i++) {
      widths.push(wideElements[digits[pair]].includes(i) ? 3 : 1);
      widths.push(wideElements[digits[pair + 1]].includes(i) ? 3 : 1);
    }
  }
  return [...widths, 3, 1, 1];
}

export default function ParcelLabel({ id }) {
  const [open, setOpen] = useState(false);
  const query = useGetParcelLabelQuery(id, { skip: !open });
  const code = query.currentData?.barcode;
  let x = 12;
  const bars = /^\d{16}$/.test(code) && barcodeWidths(code).map((width, i) => {
    const start = x; x += width;
    return i % 2 ? null : <rect key={i} x={start} y="4" width={width} height="42" />;
  });
  return <section className="card"><button className="btn" onClick={() => setOpen(!open)}>{open ? 'Hide parcel label' : 'Show parcel label'}</button>
    {open && (bars ? <div><p>Attach this label to parcel {id} before pickup.</p>
      <svg role="img" aria-label={'Parcel barcode ' + code} viewBox={`0 0 ${x + 12} 62`} style={{ width: '100%', maxWidth: 420, background: 'white', color: 'black' }}>
        <rect width="100%" height="100%" fill="white" />{bars}<text x="50%" y="58" textAnchor="middle" fontSize="9">{code}</text>
      </svg><div><button className="btn" onClick={() => window.print()}>Print parcel label</button></div></div> : <p>{query.isFetching ? 'Loading label…' : 'Label unavailable'}</p>)}
  </section>;
}
