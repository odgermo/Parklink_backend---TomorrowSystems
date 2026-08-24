import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const VerificationTicket = () => {
  const { reservationId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const { data } = await api.get(`/reservations/verifier/${reservationId}`);
        setTicket(data);
      } catch (err) {
        setErreur('Ticket introuvable ou invalide');
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, [reservationId]);

  const statutLabel = {
    confirmee: { label: 'Place confirmée', color: 'emerald' },
    terminee:  { label: 'Réservation terminée', color: 'slate' },
    annulee:   { label: 'Réservation annulée', color: 'red' },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      style={{fontFamily:"'DM Sans', sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');`}</style>

      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-sky-600 to-sky-400 px-6 py-5 text-center">
          <div className="text-3xl mb-2">🎫</div>
          <h1 style={{fontFamily:"'DM Serif Display'"}} className="text-white text-xl font-normal">
            Vérification ParkLink
          </h1>
        </div>

        {chargement ? (
          <div className="p-10 flex justify-center">
            <svg className="animate-spin w-8 h-8 text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : erreur ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-500 font-semibold text-sm">{erreur}</p>
            <p className="text-slate-400 text-xs mt-2">Vérifiez que le QR code n'a pas expiré ou été altéré.</p>
          </div>
        ) : ticket && (
          <div className="p-6 space-y-4">

            {/* Statut */}
            <div className={`text-center py-3 rounded-xl bg-${statutLabel[ticket.statut]?.color || 'slate'}-50 border border-${statutLabel[ticket.statut]?.color || 'slate'}-200`}>
              <span className={`font-bold text-${statutLabel[ticket.statut]?.color || 'slate'}-700`}>
                {ticket.statut === 'confirmee' && '✅ '}
                {ticket.statut === 'annulee' && '❌ '}
                {ticket.statut === 'terminee' && '🏁 '}
                {statutLabel[ticket.statut]?.label || ticket.statut}
              </span>
            </div>

            {/* Parking */}
            <div className="text-center pb-3 border-b border-dashed border-slate-200">
              <div className="font-bold text-slate-900">{ticket.parkings?.nom}</div>
              <div className="text-slate-400 text-xs">{ticket.parkings?.adresse}</div>
            </div>

            {/* Créneau */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Arrivée</div>
                <div className="font-semibold text-slate-900 text-sm">
                  {new Date(ticket.heure_debut).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                </div>
                <div className="text-slate-600 text-sm">
                  {new Date(ticket.heure_debut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Départ</div>
                <div className="font-semibold text-slate-900 text-sm">
                  {new Date(ticket.heure_fin).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                </div>
                <div className="text-slate-600 text-sm">
                  {new Date(ticket.heure_fin).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>

            {/* Véhicule */}
            {ticket.vehicules && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                <div className="text-xs text-sky-700 font-semibold mb-1">Véhicule</div>
                <div className="text-sm font-bold text-slate-900">{ticket.vehicules.plaque}</div>
                <div className="text-xs text-slate-500">
                  {[ticket.vehicules.marque, ticket.vehicules.modele, ticket.vehicules.couleur].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}

            {/* Conducteur */}
            {ticket.users && (
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                <span className="text-xs text-slate-500">Conducteur</span>
                <span className="text-sm font-semibold text-slate-900">
                  {ticket.users.prenom} {ticket.users.nom?.[0]}.
                </span>
              </div>
            )}

            {/* Montant + paiement */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <span className="text-xs text-emerald-700">Montant</span>
              <div className="text-right">
                <div className="font-bold text-emerald-700 text-lg">{ticket.montant_total} MAD</div>
                <div className="text-xs text-emerald-600">
                  {ticket.paiement === 'especes' ? '💵 Espèces' : '💳 Carte'}
                </div>
              </div>
            </div>

            {/* Référence */}
            <div className="text-center text-slate-400 text-xs">
              Référence : {ticket.id?.slice(0, 8).toUpperCase()}
            </div>
          </div>
        )}

        <div className="bg-slate-50 px-6 py-3 text-center">
          <p className="text-slate-400 text-xs">Vérification officielle ParkLink</p>
        </div>
      </div>
    </div>
  );
};

export default VerificationTicket;