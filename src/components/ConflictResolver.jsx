import React, { useState } from 'react';
import { AppIcon } from './AppIcon';

export function ConflictResolver({ conflict, onResolve, onCancel }) {
    const fields = Object.keys(conflict?.conflicts || {});
    const [choices, setChoices] = useState(() => Object.fromEntries(fields.map((field) => [field, 'latest'])));
    return (
        <div className="modal-overlay conflict-overlay"><section className="modal-content conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
            <div className="modal-header"><div><span className="eyebrow"><AppIcon name="Activity" size={13} /> Edit conflict</span><h2 className="modal-title" id="conflict-title">This screenshot changed while you edited</h2></div></div>
            <div className="modal-body"><p className="text-muted">Choose the final value for each overlapping field. Non-overlapping changes remain preserved.</p>
                {fields.map((field) => { const values = conflict.conflicts[field]; return <fieldset className="conflict-field" key={field}><legend>{field.replace(/_/g, ' ')}</legend>{[['latest', 'Keep latest', values.latest], ['mine', 'Use mine', values.mine]].map(([choice, label, value]) => <label className={choices[field] === choice ? 'active' : ''} key={choice}><input type="radio" name={field} checked={choices[field] === choice} onChange={() => setChoices((current) => ({ ...current, [field]: choice }))} /><span><strong>{label}</strong><code>{String(value ?? '')}</code></span></label>)}</fieldset>; })}
            </div>
            <div className="modal-footer"><button type="button" className="button button-quiet" onClick={onCancel}>Keep editing</button><button type="button" className="button button-primary" onClick={() => onResolve(choices, conflict.latest)}>Resolve & publish</button></div>
        </section></div>
    );
}
