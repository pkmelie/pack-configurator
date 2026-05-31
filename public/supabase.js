// supabase.js
// 1. Importer le SDK Supabase
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
script.onload = () => {
    // 2. Initialiser le client
    const supabaseUrl = 'https://jefxkfkwrdzagbeptyqo.supabase.co'; 
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZnhrZmt3cmR6YWdiZXB0eXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzczOTMsImV4cCI6MjA4ODkxMzM5M30.4w42OUP_yBTeT98BjDhY88wQKCFbF8djXg1kBcVOVRw';
    // Remplace ton ancienne ligne par celle-ci :
    window.supabase = supabase.createClient(supabaseUrl, supabaseKey);
    
    // Déclencher un événement quand Supabase est prêt
    document.dispatchEvent(new Event('supabaseReady'));
};
document.head.appendChild(script);