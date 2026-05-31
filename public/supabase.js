// supabase.js
// 1. Importer le SDK Supabase
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
script.onload = () => {
    // 2. Initialiser le client
    const supabaseUrl = 'TON_URL_SUPABASE'; // Ex: https://xyz.supabase.co
    const supabaseKey = 'TA_CLE_ANON_SUPABASE';
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    
    // Déclencher un événement quand Supabase est prêt
    document.dispatchEvent(new Event('supabaseReady'));
};
document.head.appendChild(script);