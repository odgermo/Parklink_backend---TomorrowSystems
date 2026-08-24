import { useState } from 'react';
import api from '../../services/api';

const GABARITS_OPTIONS = [
  { val: 'petit', icon: '🚗', label: 'Petit',  exemples: 'Kia Picanto, Hyundai i10, Peugeot 108' },
  { val: 'moyen', icon: '🚙', label: 'Moyen',  exemples: 'Dacia Logan, Renault Clio, Peugeot 308' },
  { val: 'grand', icon: '🚐', label: 'Grand',  exemples: 'Hyundai Tucson, Toyota Prado, BMW X5' },
  { val: 'moto',  icon: '🏍️', label: 'Moto',   exemples: 'Moto, scooter' },
];

const ACCES_OPTIONS = [
  { id: 'pmr', icon: '♿', label: 'Accès PMR' },
];

const SERVICES_LISTE = [
  { id: 'lavage',   icon: '🚿', label: 'Lavage',              unite: 'MAD',     placeholder: 'Ex: 30' },
  { id: 'recharge', icon: '⚡', label: 'Recharge électrique', unite: 'MAD/kWh', placeholder: 'Ex: 3' },
  { id: 'valet',    icon: '🤵', label: 'Valet parking',       unite: 'MAD',     placeholder: 'Ex: 50' },
  { id: 'courses',  icon: '🛒', label: 'Transport de courses',unite: 'MAD',     placeholder: 'Ex: 20' },
];

const INFRASTRUCTURE = [
  { val: 'surface',    icon: '☀️', label: 'En surface' },
  { val: 'souterrain', icon: '⬇️', label: 'Souterrain' },
  { val: 'residentiel',icon: '🏘️', label: 'Résidentiel' },
  { val: 'relais',     icon: '🚌', label: 'Relais (P+R)' },
];

const MODE_GESTION = [
  { val: 'public', icon: '🏛️', label: 'Public' },
  { val: 'prive',  icon: '🔒', label: 'Privé' },
];

const FormulaireModifierParking = ({ parking, onFermer, onSucces }) => {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(false);

  // Services : objet { lavage: 30, recharge: 3, ... }
  const initialServices = () => {
    const s = parking.services;
    if (s && typeof s === 'object' && !Array.isArray(s)) return s;
    if (Array.isArray(s)) {
      const obj = {};
      s.forEach(id => { obj[id] = 0; });
      return obj;
    }
    return {};
  };

  const [servicesActifs, setServicesActifs] = useState(initialServices());
  const [tarifsServices, setTarifsServices] = useState(initialServices());

  const [gabaritsAcceptes, setGabaritsAcceptes] = useState(
    Array.isArray(parking.vehicules_acceptes)
      ? parking.vehicules_acceptes.filter(v => ['petit', 'moyen', 'grand', 'moto'].includes(v))
      : ['petit', 'moyen', 'grand']
  );

  const [accesActifs, setAccesActifs] = useState(
    Array.isArray(parking.vehicules_acceptes)
      ? parking.vehicules_acceptes.filter(v => v === 'pmr')
      : []
  );

  const [hauteurLimite, setHauteurLimite] = useState(parking.hauteur_limite || '');

  const [form, setForm] = useState({
    nom: parking.nom || '',
    adresse: parking.adresse || '',
    capacite_totale: parking.capacite_totale || '',
    tarif_horaire: parking.tarif_horaire || '',
    tarif_journalier: parking.tarif_journalier || '',
    horaire_ouverture: parking.horaire_ouverture?.slice(0, 5) || '08:00',
    horaire_fermeture: parking.horaire_fermeture?.slice(0, 5) || '22:00',
    infrastructure: parking.infrastructure || 'surface',
    mode_gestion: parking.mode_gestion || 'public',
    source_disponibilite: parking.source_disponibilite || 'manuel',
    api_url: parking.api_url || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErreur('');
  };

  const toggleGabarit = (val) => {
    setGabaritsAcceptes(prev =>
      prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]
    );
  };

  const toggleAcces = (id) => {
    setAccesActifs(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleService = (id) => {
    if (servicesActifs[id] !== undefined) {
      const updated = { ...servicesActifs };
      delete updated[id];
      setServicesActifs(updated);
      const t = { ...tarifsServices };
      delete t[id];
      setTarifsServices(t);
    } else {
      setServicesActifs(prev => ({ ...prev, [id]: 0 }));
      setTarifsServices(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const mettreAJourTarif = (id, val) => {
    setTarifsServices(prev => ({ ...prev, [id]: val }));
  };

  const soumettre = async (e) => {
    e.preventDefault();
    if (!form.tarif_horaire || !form.capacite_totale) {
      setErreur('Le tarif horaire et la capacité sont obligatoires');
      return;
    }
    if (gabaritsAcceptes.length === 0) {
      setErreur('Sélectionnez au moins un type de véhicule');
      return;
    }

    // Construire l'objet services final avec tarifs validés
    const servicesFinaux = {};
    for (const id of Object.keys(servicesActifs)) {
      servicesFinaux[id] = parseFloat(tarifsServices[id]) || 0;
    }

    setChargement(true);
    setErreur('');
    try {
      await api.patch(`/parkings/${parking.id}`, {
        ...form,
        services: servicesFinaux,
        vehicules_acceptes: [...gabaritsAcceptes, ...accesActifs],
        hauteur_limite: hauteurLimite ? parseFloat(hauteurLimite) : null,
      });
      setSucces(true);
      setTimeout(() => onSucces(), 1500);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de la modification');
    } finally {
      setChargement(false);
    }
  };

  const input = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-sky-400";
  const label = "block text-xs font-semibold text-slate-600 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{fontFamily:"'DM Sans', sans-serif"}}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">

        <div className="bg-gradient-to-r from-sky-700 to-sky-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 style={{fontFamily:"'DM Serif Display'"}}
              className="text-white text-xl font-normal">Modifier le parking</h2>
            <p className="text-sky-100 text-xs mt-0.5">{parking.nom}</p>
          </div>
          <button onClick={onFermer} className="text-white/70 hover:text-white text-2xl">✕</button>
        </div>

        {succes ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">✅</div>
            <h3 style={{fontFamily:"'DM Serif Display'"}} className="text-xl text-slate-900 mb-2">
              Modifications enregistrées
            </h3>
            <p className="text-slate-500 text-sm">
              Votre parking est en attente de validation par l'administrateur.
            </p>
          </div>
        ) : (
          <form onSubmit={soumettre} className="p-6 max-h-[70vh] overflow-y-auto space-y-5">

            {/* Nom + Adresse */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={label}>Nom du parking</label>
                <input name="nom" value={form.nom} onChange={handleChange} className={input}/>
              </div>
              <div className="col-span-2">
                <label className={label}>Adresse</label>
                <input name="adresse" value={form.adresse} onChange={handleChange} className={input}/>
              </div>
            </div>

            {/* Infrastructure */}
            <div>
              <label className={label}>Type d'infrastructure</label>
              <div className="grid grid-cols-4 gap-2">
                {INFRASTRUCTURE.map(opt => (
                  <div key={opt.val}
                    onClick={() => setForm({...form, infrastructure: opt.val})}
                    className={`cursor-pointer border-2 rounded-xl p-2 text-center transition-all ${
                      form.infrastructure === opt.val
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 hover:border-sky-200'
                    }`}>
                    <div className="text-xl">{opt.icon}</div>
                    <div className="text-xs text-slate-700 mt-0.5">{opt.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mode gestion */}
            <div>
              <label className={label}>Mode de gestion</label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_GESTION.map(opt => (
                  <div key={opt.val}
                    onClick={() => setForm({...form, mode_gestion: opt.val})}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all ${
                      form.mode_gestion === opt.val
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 hover:border-sky-200'
                    }`}>
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capacité + Tarifs + Horaires */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Capacité totale</label>
                <input name="capacite_totale" type="number" min="1"
                  value={form.capacite_totale} onChange={handleChange} className={input}/>
              </div>
              <div>
                <label className={label}>Tarif horaire (MAD/h)</label>
                <input name="tarif_horaire" type="number" step="0.5"
                  value={form.tarif_horaire} onChange={handleChange} className={input}/>
              </div>
              <div>
                <label className={label}>Tarif journalier (MAD) <span className="font-normal text-slate-400">optionnel</span></label>
                <input name="tarif_journalier" type="number"
                  value={form.tarif_journalier} onChange={handleChange} className={input}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Ouverture</label>
                  <input name="horaire_ouverture" type="time"
                    value={form.horaire_ouverture} onChange={handleChange} className={input}/>
                </div>
                <div>
                  <label className={label}>Fermeture</label>
                  <input name="horaire_fermeture" type="time"
                    value={form.horaire_fermeture} onChange={handleChange} className={input}/>
                </div>
              </div>
            </div>

            {/* Véhicules acceptés */}
            <div>
              <label className={label}>Véhicules acceptés</label>
              <p className="text-xs text-slate-500 mb-2">Cochez tous les types que votre parking peut accueillir.</p>
              <div className="grid grid-cols-2 gap-2">
                {GABARITS_OPTIONS.map(g => {
                  const actif = gabaritsAcceptes.includes(g.val);
                  return (
                    <div key={g.val} onClick={() => toggleGabarit(g.val)}
                      className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${
                        actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                      }`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-2xl">{g.icon}</span>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          actif ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                        }`}>
                          {actif && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{g.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-tight">{g.exemples}</div>
                    </div>
                  );
                })}
              </div>
              {gabaritsAcceptes.length === 0 && (
                <p className="text-red-400 text-xs mt-1">⚠️ Sélectionnez au moins un type de véhicule.</p>
              )}
            </div>

            {/* Hauteur limite — souterrain uniquement */}
            {form.infrastructure === 'souterrain' && (
              <div>
                <label className={label}>Hauteur limite d'accès <span className="font-normal text-slate-400">optionnel</span></label>
                <p className="text-xs text-slate-500 mb-2">Laissez vide pour afficher "2,10 m (standard)" aux conducteurs.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" step="0.05" min="1.5" max="4"
                    value={hauteurLimite}
                    onChange={e => setHauteurLimite(e.target.value)}
                    placeholder="Ex: 1.90"
                    className={`${input} max-w-32`}
                  />
                  <span className="text-sm text-slate-500">mètres</span>
                </div>
              </div>
            )}

            {/* Accès PMR uniquement */}
            <div>
              <label className={label}>Accès complémentaire</label>
              {ACCES_OPTIONS.map(a => {
                const actif = accesActifs.includes(a.id);
                return (
                  <div key={a.id}
                    onClick={() => toggleAcces(a.id)}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all max-w-xs ${
                      actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                    }`}>
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-sm font-medium text-slate-800">{a.label}</span>
                    {actif && <span className="ml-auto text-sky-500 text-xs font-bold">✓</span>}
                  </div>
                );
              })}
            </div>

            {/* Services extra avec tarifs */}
            <div>
              <label className={label}>Services extra</label>
              <p className="text-xs text-slate-500 mb-3">Activez les services proposés et définissez leur tarif additionnel.</p>
              <div className="space-y-2">
                {SERVICES_LISTE.map(s => {
                  const actif = servicesActifs[s.id] !== undefined;
                  return (
                    <div key={s.id} className={`border-2 rounded-xl p-3 transition-all ${
                      actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleService(s.id)}>
                          <span className="text-xl">{s.icon}</span>
                          <span className="text-sm font-medium text-slate-800">{s.label}</span>
                        </div>
                        <button type="button" onClick={() => toggleService(s.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${actif ? 'bg-sky-500' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {actif && (
                        <div className="flex items-center gap-2 mt-2 bg-white border border-sky-200 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-slate-500 flex-1">Tarif additionnel</span>
                          <input
                            type="number" min="0" step="0.5"
                            value={tarifsServices[s.id] ?? 0}
                            onChange={e => mettreAJourTarif(s.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-16 text-right text-sm font-semibold text-sky-600 focus:outline-none bg-transparent"
                          />
                          <span className="text-xs text-slate-500">{s.unite}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source disponibilité */}
            <div>
              <label className={label}>Source des disponibilités</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val:'manuel', icon:'✋', titre:'Manuelle' },
                  { val:'api',    icon:'🔗', titre:'Via API' },
                ].map(opt => (
                  <div key={opt.val}
                    onClick={() => setForm({...form, source_disponibilite: opt.val})}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all ${
                      form.source_disponibilite === opt.val
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 hover:border-sky-200'
                    }`}>
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-sm font-medium text-slate-700">{opt.titre}</span>
                  </div>
                ))}
              </div>
              {form.source_disponibilite === 'api' && (
                <input name="api_url" type="url" value={form.api_url}
                  onChange={handleChange} placeholder="https://votre-api.com/..."
                  className={`${input} mt-2`}/>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <p className="text-amber-700 text-xs">
                Toute modification remet le parking en attente de validation par l'administrateur avant d'être visible sur la carte.
              </p>
            </div>

            {erreur && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                ⚠️ {erreur}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onFermer}
                className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50">
                Annuler
              </button>
              <button type="submit" disabled={chargement}
                className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {chargement
                  ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : '💾 Enregistrer les modifications'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FormulaireModifierParking;