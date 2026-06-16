// seo-assistant.jsx
import React, { useState, useEffect } from 'react';

export default function SeoAssistant() {
    const [sujet, setSujet] = useState('');
    const [motsCles, setMotsCles] = useState('');
    const [resultat, setResultat] = useState('');
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(false);

    // Charger les crédits au démarrage
    useEffect(() => {
        fetch('http://localhost:5000/api/user')
            .then(res => res.json())
            .then(data => setCredits(data.credits));
    }, []);

    const genererArticle = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sujet, motsCles })
            });
            
            const data = await res.json();
            
            if (res.status === 402) {
                alert("🚨 " + data.message); // Paywall atteint
            } else if (data.success) {
                setResultat(data.content);
                setCredits(data.creditsRestants); // Mise à jour du compteur
            }
        } catch (err) {
            alert("Erreur de connexion au serveur.");
        }
        setLoading(false);
    };

    const acheterCredits = () => {
        // Redirection vers le lien de paiement Stripe (Payment Link)
        window.location.href = "[https://buy.stripe.com/test_ton_lien_de_paiement](https://buy.stripe.com/test_ton_lien_de_paiement)";
    };

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif' }}>
            <h1>🤖 Ton SaaS de Contenu SEO</h1>
            
            
            <div style={{ padding: '15px', background: '#f3f4f6', borderRadius: '8px', marginBottom: '20px' }}>
                <strong>Crédits restants : </strong> 
                <span style={{ color: credits > 0 ? 'green' : 'red', fontSize: '18px' }}>
                    {credits}
                </span>
            </div>

            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                    type="text" 
                    placeholder="Sujet de l'article (ex: Les bienfaits du matcha)" 
                    value={sujet} 
                    onChange={(e) => setSujet(e.target.value)}
                    style={{ padding: '10px', fontSize: '16px' }}
                />
                <input 
                    type="text" 
                    placeholder="Mots-clés (séparés par des virgules)" 
                    value={motsCles} 
                    onChange={(e) => setMotsCles(e.target.value)}
                    style={{ padding: '10px', fontSize: '16px' }}
                />

                
                {credits > 0 ? (
                    <button 
                        onClick={genererArticle} 
                        disabled={loading || !sujet}
                        style={{ padding: '15px', background: '#000', color: '#fff', cursor: 'pointer' }}
                    >
                        {loading ? 'Génération en cours...' : 'Générer l\'article (1 crédit)'}
                    </button>
                ) : (
                    <button 
                        onClick={acheterCredits}
                        style={{ padding: '15px', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
                    >
                        💳 Acheter des crédits pour continuer
                    </button>
                )}
            </div>

            
            {resultat && (
                <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd' }}>
                    <div dangerouslySetInnerHTML={{ __html: resultat }} />
                </div>
            )}
        </div>
    );
}