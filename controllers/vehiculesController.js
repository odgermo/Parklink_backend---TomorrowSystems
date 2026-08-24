const supabase = require('../supabase');

const mesVehicules = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehicules')
      .select('*')
      .eq('conducteur_id', req.utilisateur.id)
      .order('cree_le', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const ajouter = async (req, res) => {
  const { plaque, marque, modele, couleur, gabarit } = req.body;
  if (!plaque) return res.status(400).json({ erreur: 'La plaque est obligatoire' });

  try {
    const { data: existant } = await supabase
      .from('vehicules')
      .select('id')
      .eq('conducteur_id', req.utilisateur.id)
      .eq('plaque', plaque.toUpperCase())
      .single();

    if (existant) return res.status(409).json({ erreur: 'Ce véhicule est déjà enregistré' });

    const { data, error } = await supabase
      .from('vehicules')
      .insert([{
        conducteur_id: req.utilisateur.id,
        plaque: plaque.toUpperCase(),
        marque: marque || null,
        modele: modele || null,
        couleur: couleur || null,
        gabarit: gabarit || 'moyen',
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Véhicule ajouté', vehicule: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const modifier = async (req, res) => {
  const { plaque, marque, modele, couleur, gabarit } = req.body;

  try {
    const { data: vehicule } = await supabase
      .from('vehicules')
      .select('conducteur_id')
      .eq('id', req.params.id)
      .single();

    if (!vehicule) return res.status(404).json({ erreur: 'Véhicule introuvable' });
    if (vehicule.conducteur_id !== req.utilisateur.id) return res.status(403).json({ erreur: 'Accès refusé' });

    const updates = {};
    if (plaque) updates.plaque = plaque.toUpperCase();
    if (marque) updates.marque = marque;
    if (modele) updates.modele = modele;
    if (couleur) updates.couleur = couleur;
    if (gabarit) updates.gabarit = gabarit;

    const { data, error } = await supabase
      .from('vehicules')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Véhicule mis à jour', vehicule: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const supprimer = async (req, res) => {
  try {
    const { data: vehicule } = await supabase
      .from('vehicules')
      .select('conducteur_id')
      .eq('id', req.params.id)
      .single();

    if (!vehicule) return res.status(404).json({ erreur: 'Véhicule introuvable' });
    if (vehicule.conducteur_id !== req.utilisateur.id) return res.status(403).json({ erreur: 'Accès refusé' });

    const { error } = await supabase.from('vehicules').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Véhicule supprimé' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

module.exports = { mesVehicules, ajouter, modifier, supprimer };