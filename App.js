// ============================================================================
// MERCA V7 — VERSION COMPLÈTE
// Nouveautés par rapport à la V5/V6 :
// 1. Accès INVITÉ (sans inscription) : parcourir le catalogue est possible
//    sans compte, mais sans les 3000 points de bienvenue, sans recherche
//    élargie (juste la recherche exacte) et sans accès à PERMUTA — un
//    message invite à s'inscrire pour débloquer le reste.
// 2. Réservation de service (Employé Pro) : un client parcourt les services
//    disponibles, choisit un créneau, réserve — l'Employé Pro confirme puis
//    marque "Terminé".
// 3. Avis (notes 1 à 5 étoiles + commentaire) sur une boutique ou un bureau,
//    affichés en moyenne sur leur page.
// 4. Support par commande/réservation : messagerie interne simple +
//    signalement d'un problème (réclamation/litige).
// 5. Vérification d'identité (KYC) simulée dans les Paramètres, avec badge
//    "✅ Vérifié" affiché sur la boutique/le bureau/le profil livreur.
// 6. Icônes de rôle redessinées : badges ronds colorés distincts par rôle
//    (Client=bleu, Commerçant=ambre, Livreur=vert, Employé Pro=violet).
// 7. Photo de profil (avatar) choisie par l'utilisateur, affichée partout
//    dans l'app à la place de l'icône générique.
//
// PRÉCISION IMPORTANTE ET HONNÊTE : une application ne peut pas remplacer
// TOUTE SEULE l'icône de l'app sur l'écran d'accueil du téléphone par une
// photo choisie librement par l'utilisateur — iOS et Android l'interdisent
// pour des raisons de sécurité (un logiciel malveillant pourrait sinon se
// faire passer pour une autre app). Ce qui EST possible, et que j'ai codé
// ci-dessous : une vraie photo de profil utilisée PARTOUT DANS L'APP
// (en-tête, profil, avis...). C'est l'équivalent qui fonctionne réellement.
//
// Dépendance à installer pour la photo de profil :
//   npm install expo-image-picker
// (ou l'équivalent react-native-image-picker si le projet n'utilise pas Expo)
// ============================================================================

import React, { useMemo, useState, useEffect } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, Alert, Modal, Image, ImageBackground, Switch, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
// (notifications push : chargées uniquement à l'usage, voir registerPushToken plus bas -
// évite un plantage au démarrage dans Expo Go, qui ne supporte plus cette fonctionnalité)

const STORAGE_KEY = "MERCA_STATE_V7";

const IMG = {
  hero_home:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900",
  hero_client:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900",
  hero_merchant:"https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900",
  hero_courier:"https://images.unsplash.com/photo-1526367790999-0150786686a2?w=900",
  hero_wallet:"https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=900",
  hero_permuta:"https://images.unsplash.com/photo-1558655146-d09347e92766?w=900",
  hero_pro:"https://images.unsplash.com/photo-1497366216548-37526070297c?w=900",
  hero_auth:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900",
  hero_services:"https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900",
  iphone:"https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500",
  samsung:"https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=500",
  pc:"https://images.unsplash.com/photo-1588872657576-7efd1f1555ed?w=500",
  baffle:"https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500",
  canape:"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500",
  boutique:"https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400",
  bureau:"https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400",
};

const R = { BLOQUE:50, FRAIS_PRODUIT:0.02, FRAIS_SERVICE:0.20, BASE:1500, SPLIT_LIVREUR:600, SPLIT_MARCHAND:450, SPLIT_MERCA:450, POINTS_PAR_LIVRAISON:0.10, POINTS_LIVREUR_ACTIVATION:1000, POINTS_PRO_ACTIVATION:500, POINTS_INSCRIPTION:5000, ARGENT:10000, OR:15000, OR_CYCLE_MOIS:9 };

// ---- Connexion au vrai serveur (backend) MERCA hébergé sur Render ----
const API_BASE = "https://merca-backend-flwv.onrender.com";

async function apiRequestOtp(phone){
  let res;
  try{ res = await fetch(`${API_BASE}/auth/otp/request`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone }) }); }
  catch(e){ throw new Error(`Réseau: ${e.message}`); } // ex: vraie coupure internet, message précis au lieu d'un texte générique
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? `Serveur (${res.status}): ${Array.isArray(data.message)?data.message.join(", "):data.message}` : `Erreur serveur (${res.status})`);
  return data;
}
async function apiVerifyOtp(phone, code, referralCode){
  let res;
  try{ res = await fetch(`${API_BASE}/auth/otp/verify`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone, code, referralCode: referralCode||undefined }) }); }
  catch(e){ throw new Error(`Réseau: ${e.message}`); }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : `Erreur serveur (${res.status})`);
  return data; // { accessToken, user }
}
async function apiGetWallet(token){
  const res = await fetch(`${API_BASE}/wallet`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger le portefeuille");
  return res.json(); // { balance }
}
async function apiUpdateProfile(token, dto){
  const res = await fetch(`${API_BASE}/users/me`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  if(!res.ok) throw new Error("Impossible de mettre à jour le profil");
  return res.json();
}
async function apiAddRole(token, dto){
  const res = await fetch(`${API_BASE}/users/me/roles`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  if(!res.ok) throw new Error("Impossible d'activer ce rôle");
  return res.json();
}
// ---- MERCA CERCLE (parrainage) ----
async function apiMyCircle(token){
  const res = await fetch(`${API_BASE}/users/me/circle`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger ton Cercle");
  return res.json(); // { code, invitedCount, activeCount }
}
// ---- Catalogue produits réel (serveur) ----
async function apiGetProducts(city){
  const res = await fetch(`${API_BASE}/products${city?`?city=${encodeURIComponent(city)}`:""}`);
  if(!res.ok) throw new Error("Impossible de charger les produits du serveur");
  return res.json();
}
// Recherche intelligente : tolère les fautes de frappe et priorise les
// commerçants les plus proches (élargit le rayon automatiquement si rien
// n'est trouvé près de l'utilisateur). token optionnel (fonctionne aussi en invité).
async function apiSmartSearch(query, token){
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/products/search?${params.toString()}`, { headers: token?{ Authorization:`Bearer ${token}` }:{} });
  if(!res.ok) throw new Error("Recherche indisponible");
  return res.json(); // { results, radiusUsedKm }
}
async function apiCreateProduct(token, dto){
  const res = await fetch(`${API_BASE}/products`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer le produit");
  return data;
}
async function apiUpdateProduct(token, id, dto){
  const res = await fetch(`${API_BASE}/products/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de modifier le produit");
  return data;
}
// Convertit un produit reçu du serveur (champs anglais/techniques) vers le
// format utilisé partout dans l'app (champs français déjà existants)
function serverToLocalProduct(p){
  return { id:p.id, merchantId:p.merchantId, name:p.name, price:Number(p.price), cat:p.category||"Autre", shop:p.shopName||"Boutique MERCA", rating:5, stock:p.stock, desc:p.description||"", ville:p.city||"Yaoundé", rayon:1, last: p.priceLockedUntil ? new Date(p.priceLockedUntil).getTime()-R.BLOQUE*86400000 : 0, img:p.img||IMG.boutique };
}
// ---- Commandes réelles (serveur) ----
async function apiCreateOrder(token, dto){
  const res = await fetch(`${API_BASE}/orders`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer la commande");
  return data;
}
async function apiAdvanceOrder(token, id){
  const res = await fetch(`${API_BASE}/orders/${id}/advance`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de faire avancer la commande");
  return data;
}
async function apiConfirmOrder(token, id){
  const res = await fetch(`${API_BASE}/orders/${id}/confirm`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de confirmer la réception");
  return data;
}
async function apiGetMyOrders(token){
  const res = await fetch(`${API_BASE}/orders/mine`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger tes commandes");
  return res.json();
}
async function apiGetOrdersToFulfill(token){
  const res = await fetch(`${API_BASE}/orders/to-fulfill`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger les commandes reçues");
  return res.json();
}
async function apiGetAvailableOrders(token){
  const res = await fetch(`${API_BASE}/orders/available`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger les livraisons disponibles");
  return res.json();
}
async function apiGetMyDeliveries(token){
  const res = await fetch(`${API_BASE}/orders/deliveries`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger tes livraisons");
  return res.json();
}
// ---- Services réels (serveur) ----
async function apiGetServices(domaine){
  const res = await fetch(`${API_BASE}/services${domaine?`?domaine=${encodeURIComponent(domaine)}`:""}`);
  if(!res.ok) throw new Error("Impossible de charger les services");
  return res.json();
}
async function apiCreateService(token, dto){
  const res = await fetch(`${API_BASE}/services`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer le service");
  return data;
}
async function apiUpdateService(token, id, dto){
  const res = await fetch(`${API_BASE}/services/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de modifier le service");
  return data;
}
// ---- Réservations réelles (serveur) ----
async function apiCreateBooking(token, dto){
  const res = await fetch(`${API_BASE}/bookings`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer la réservation");
  return data;
}
async function apiConfirmBooking(token, id){
  const res = await fetch(`${API_BASE}/bookings/${id}/confirm`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de confirmer");
  return data;
}
async function apiCompleteBooking(token, id){
  const res = await fetch(`${API_BASE}/bookings/${id}/complete`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de terminer");
  return data;
}
async function apiCancelBooking(token, id){
  const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible d'annuler");
  return data;
}
async function apiGetMyBookings(token){
  const res = await fetch(`${API_BASE}/bookings/mine`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger tes réservations");
  return res.json();
}
async function apiGetBookingsToFulfill(token){
  const res = await fetch(`${API_BASE}/bookings/to-fulfill`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger les réservations reçues");
  return res.json();
}
// ---- Administration MERCA (toi uniquement - le serveur vérifie aussi ton statut admin) ----
async function apiAdminStats(token, adminPassword){
  const res = await fetch(`${API_BASE}/admin/stats`, { headers:{ Authorization:`Bearer ${token}`, "x-admin-password":adminPassword } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : "Impossible de charger les statistiques");
  return data;
}
async function apiAdminUsers(token, adminPassword){
  const res = await fetch(`${API_BASE}/admin/users`, { headers:{ Authorization:`Bearer ${token}`, "x-admin-password":adminPassword } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : "Impossible de charger les utilisateurs");
  return data;
}
async function apiAdminSuspend(token, adminPassword, id){
  const res = await fetch(`${API_BASE}/admin/users/${id}/suspend`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "x-admin-password":adminPassword } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de suspendre ce compte");
  return data;
}
async function apiAdminVerify(token, adminPassword, id, role){
  const res = await fetch(`${API_BASE}/admin/users/${id}/verify`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`, "x-admin-password":adminPassword}, body: JSON.stringify({ role }) });
  if(!res.ok) throw new Error(res.status===403 ? "Mot de passe administrateur incorrect" : "Impossible de vérifier ce compte");
  return res.json();
}
async function apiAdminUserDetail(token, adminPassword, id){
  const res = await fetch(`${API_BASE}/admin/users/${id}`, { headers:{ Authorization:`Bearer ${token}`, "x-admin-password":adminPassword } });
  if(!res.ok) throw new Error("Impossible de charger le détail de ce compte");
  return res.json();
}
async function apiAdminToggleAdmin(token, adminPassword, id){
  const res = await fetch(`${API_BASE}/admin/users/${id}/toggle-admin`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "x-admin-password":adminPassword } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de modifier les droits admin");
  return data;
}
async function apiAdminWalletAdjust(token, adminPassword, id, amount){
  const res = await fetch(`${API_BASE}/admin/users/${id}/wallet-adjust`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`, "x-admin-password":adminPassword}, body: JSON.stringify({ amount }) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible d'ajuster ce portefeuille");
  return data;
}
// ---- Avis réels (liés à une vraie commande/réservation confirmée) ----
async function apiCreateReview(token, dto){
  const res = await fetch(`${API_BASE}/reviews`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : "Impossible d'envoyer l'avis");
  return data;
}
async function apiGetReviewsForTarget(targetUserId){
  const res = await fetch(`${API_BASE}/reviews/target/${targetUserId}`);
  if(!res.ok) throw new Error("Impossible de charger les avis");
  return res.json(); // { avg, count, reviews }
}
// ---- Support réel (messagerie + litiges), côté serveur ----
async function apiSendMessage(token, threadId, body){
  const res = await fetch(`${API_BASE}/support/messages`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify({ threadId, body }) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : "Impossible d'envoyer le message");
  return data;
}
async function apiGetMessages(token, threadId){
  const res = await fetch(`${API_BASE}/support/messages/${threadId}`, { headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>([]));
  if(!res.ok) throw new Error(data.message || "Impossible de charger les messages");
  return data;
}
async function apiCreateDispute(token, threadId, reason, description){
  const res = await fetch(`${API_BASE}/support/disputes`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify({ threadId, reason, description }) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message ? (Array.isArray(data.message)?data.message.join(", "):data.message) : "Impossible d'envoyer la réclamation");
  return data;
}
async function apiGetThreadDisputes(token, threadId){
  const res = await fetch(`${API_BASE}/support/disputes/${threadId}`, { headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>([]));
  if(!res.ok) throw new Error(data.message || "Impossible de charger les réclamations");
  return data;
}
// Réveille le serveur dès l'ouverture de l'app (plan gratuit Render = mise en veille
// après inactivité, jusqu'à 50-90s pour redémarrer). Appelée tout de suite au chargement,
// pendant que l'utilisateur remplit le formulaire, pour que le serveur soit déjà prêt.
function apiWakeUp(){ fetch(`${API_BASE}/products`).catch(()=>{}); }

// ---- Multi-comptes : garder plusieurs comptes connectés sur le même
// téléphone, et basculer de l'un à l'autre sans repasser par le code SMS ----
const ACCOUNTS_KEY = "merca_accounts_list";
async function getSavedAccountsList(){
  try{
    const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
async function upsertSavedAccountInList(account){
  // account = { phone, accessToken, user }
  const list = await getSavedAccountsList();
  const filtered = list.filter(a=>a.phone!==account.phone);
  filtered.push(account);
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(filtered)).catch(()=>{});
  return filtered;
}
async function removeSavedAccountFromList(phone){
  const list = await getSavedAccountsList();
  const filtered = list.filter(a=>a.phone!==phone);
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(filtered)).catch(()=>{});
  return filtered;
}

// Inscrit le téléphone pour recevoir de vraies notifications (même app fermée).
// Ne fonctionne que sur une vraie app installée, jamais dans Expo Go pendant
// les tests - échoue silencieusement dans ce cas, sans gêner le reste de l'app.
async function registerPushToken(accessToken){
  try{
    // Chargement différé (dynamique) : si le module échoue (cas d'Expo Go qui
    // ne supporte plus cette fonctionnalité), l'erreur est proprement rattrapée
    // ici, au lieu de faire planter l'app dès son ouverture.
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
    const { status } = await Notifications.requestPermissionsAsync();
    if(status!=="granted") return;
    const { data:pushToken } = await Notifications.getExpoPushTokenAsync();
    if(pushToken) await apiUpdateProfile(accessToken, { pushToken });
  }catch(e){ /* normal dans Expo Go - fonctionnera dans la vraie app installée */ }
}

const CATS=["Tous","Téléphones","Informatique","Électronique","Meubles","Vêtements","Chaussures"];
const PRO_DOMAINES=["Juridique","Santé","Beauté","Réparation","Éducation","Consulting","Informatique","Autre"];
const STEPS=["Commande reçue","Préparation","Livreur recherché","En livraison","Livrée"];
const BOOKING_STEPS=["Demande envoyée","Confirmée","Terminée"];
const DISPUTE_REASONS=["Produit/service non conforme","Retard","Vendeur injoignable","Problème de paiement","Autre"];

// Icônes de rôle redessinées : icône + couleur de marque distincte par rôle
const ROLES_INFO = {
  client:{ label:"Client", icon:"👤", color:"#4F8EF7", desc:"Acheter, gagner des points" },
  commercant:{ label:"Commerçant", icon:"🏪", color:"#F5A623", desc:"Vendre des produits depuis une boutique en ligne", champ:"Nom de la boutique" },
  livreur:{ label:"Livreur", icon:"🚚", color:"#22C55E", desc:"Livrer des commandes et gagner des points", champ:"Véhicule utilisé" },
  pro:{ label:"Employé Pro", icon:"🧑‍💼", color:"#8B5CF6", desc:"Vendre un service, dans n'importe quel domaine, depuis un bureau", champ:"Nom du bureau" },
};

// ---- Indicatifs téléphoniques internationaux (liste manuelle, pas de
// dépendance externe à installer) - Cameroun placé en premier car c'est le
// marché principal de MERCA, le reste par ordre alphabétique du pays ----
const COUNTRY_CODES = [
  { code:"+237", country:"Cameroun", flag:"🇨🇲" },
  { code:"+213", country:"Algérie", flag:"🇩🇿" },
  { code:"+244", country:"Angola", flag:"🇦🇴" },
  { code:"+54", country:"Argentine", flag:"🇦🇷" },
  { code:"+61", country:"Australie", flag:"🇦🇺" },
  { code:"+43", country:"Autriche", flag:"🇦🇹" },
  { code:"+229", country:"Bénin", flag:"🇧🇯" },
  { code:"+32", country:"Belgique", flag:"🇧🇪" },
  { code:"+55", country:"Brésil", flag:"🇧🇷" },
  { code:"+226", country:"Burkina Faso", flag:"🇧🇫" },
  { code:"+257", country:"Burundi", flag:"🇧🇮" },
  { code:"+1", country:"Canada / États-Unis", flag:"🇨🇦" },
  { code:"+236", country:"Centrafrique", flag:"🇨🇫" },
  { code:"+235", country:"Tchad", flag:"🇹🇩" },
  { code:"+86", country:"Chine", flag:"🇨🇳" },
  { code:"+57", country:"Colombie", flag:"🇨🇴" },
  { code:"+242", country:"Congo-Brazzaville", flag:"🇨🇬" },
  { code:"+243", country:"RD Congo", flag:"🇨🇩" },
  { code:"+225", country:"Côte d'Ivoire", flag:"🇨🇮" },
  { code:"+45", country:"Danemark", flag:"🇩🇰" },
  { code:"+20", country:"Égypte", flag:"🇪🇬" },
  { code:"+971", country:"Émirats arabes unis", flag:"🇦🇪" },
  { code:"+34", country:"Espagne", flag:"🇪🇸" },
  { code:"+372", country:"Estonie", flag:"🇪🇪" },
  { code:"+251", country:"Éthiopie", flag:"🇪🇹" },
  { code:"+358", country:"Finlande", flag:"🇫🇮" },
  { code:"+33", country:"France", flag:"🇫🇷" },
  { code:"+241", country:"Gabon", flag:"🇬🇦" },
  { code:"+220", country:"Gambie", flag:"🇬🇲" },
  { code:"+233", country:"Ghana", flag:"🇬🇭" },
  { code:"+224", country:"Guinée", flag:"🇬🇳" },
  { code:"+245", country:"Guinée-Bissau", flag:"🇬🇼" },
  { code:"+240", country:"Guinée équatoriale", flag:"🇬🇶" },
  { code:"+91", country:"Inde", flag:"🇮🇳" },
  { code:"+62", country:"Indonésie", flag:"🇮🇩" },
  { code:"+964", country:"Irak", flag:"🇮🇶" },
  { code:"+39", country:"Italie", flag:"🇮🇹" },
  { code:"+81", country:"Japon", flag:"🇯🇵" },
  { code:"+962", country:"Jordanie", flag:"🇯🇴" },
  { code:"+254", country:"Kenya", flag:"🇰🇪" },
  { code:"+82", country:"Corée du Sud", flag:"🇰🇷" },
  { code:"+961", country:"Liban", flag:"🇱🇧" },
  { code:"+231", country:"Liberia", flag:"🇱🇷" },
  { code:"+218", country:"Libye", flag:"🇱🇾" },
  { code:"+352", country:"Luxembourg", flag:"🇱🇺" },
  { code:"+261", country:"Madagascar", flag:"🇲🇬" },
  { code:"+223", country:"Mali", flag:"🇲🇱" },
  { code:"+212", country:"Maroc", flag:"🇲🇦" },
  { code:"+230", country:"Maurice", flag:"🇲🇺" },
  { code:"+222", country:"Mauritanie", flag:"🇲🇷" },
  { code:"+52", country:"Mexique", flag:"🇲🇽" },
  { code:"+258", country:"Mozambique", flag:"🇲🇿" },
  { code:"+264", country:"Namibie", flag:"🇳🇦" },
  { code:"+227", country:"Niger", flag:"🇳🇪" },
  { code:"+234", country:"Nigeria", flag:"🇳🇬" },
  { code:"+47", country:"Norvège", flag:"🇳🇴" },
  { code:"+64", country:"Nouvelle-Zélande", flag:"🇳🇿" },
  { code:"+31", country:"Pays-Bas", flag:"🇳🇱" },
  { code:"+63", country:"Philippines", flag:"🇵🇭" },
  { code:"+48", country:"Pologne", flag:"🇵🇱" },
  { code:"+351", country:"Portugal", flag:"🇵🇹" },
  { code:"+974", country:"Qatar", flag:"🇶🇦" },
  { code:"+44", country:"Royaume-Uni", flag:"🇬🇧" },
  { code:"+7", country:"Russie", flag:"🇷🇺" },
  { code:"+250", country:"Rwanda", flag:"🇷🇼" },
  { code:"+221", country:"Sénégal", flag:"🇸🇳" },
  { code:"+232", country:"Sierra Leone", flag:"🇸🇱" },
  { code:"+65", country:"Singapour", flag:"🇸🇬" },
  { code:"+252", country:"Somalie", flag:"🇸🇴" },
  { code:"+249", country:"Soudan", flag:"🇸🇩" },
  { code:"+211", country:"Soudan du Sud", flag:"🇸🇸" },
  { code:"+46", country:"Suède", flag:"🇸🇪" },
  { code:"+41", country:"Suisse", flag:"🇨🇭" },
  { code:"+228", country:"Togo", flag:"🇹🇬" },
  { code:"+216", country:"Tunisie", flag:"🇹🇳" },
  { code:"+90", country:"Turquie", flag:"🇹🇷" },
  { code:"+256", country:"Ouganda", flag:"🇺🇬" },
  { code:"+380", country:"Ukraine", flag:"🇺🇦" },
  { code:"+260", country:"Zambie", flag:"🇿🇲" },
  { code:"+263", country:"Zimbabwe", flag:"🇿🇼" },
  { code:"+27", country:"Afrique du Sud", flag:"🇿🇦" },
  { code:"+966", country:"Arabie saoudite", flag:"🇸🇦" },
  { code:"+49", country:"Allemagne", flag:"🇩🇪" },
];

// ---- Identité visuelle MERCA : couleurs de marque + icônes de signalisation
// par rôle, à la place d'anciennes photos génériques (plus fiable, plus rapide,
// et plus reconnaissable qu'une photo de stock qui ne charge pas toujours) ----
const BRAND = "#FF6B35"; // orange MERCA - accueil, connexion
const BANNERS = {
  home:{ color:BRAND, icon:"🛍️" },
  auth:{ color:BRAND, icon:"🛍️" },
  client:{ color:ROLES_INFO.client.color, icon:"👤" },
  merchant:{ color:ROLES_INFO.commercant.color, icon:"🏪" },
  courier:{ color:ROLES_INFO.livreur.color, icon:"🚚" },
  pro:{ color:ROLES_INFO.pro.color, icon:"🧑‍💼" },
  wallet:{ color:"#0EA5A5", icon:"💰" },
  permuta:{ color:"#06B6D4", icon:"🔄" },
  services:{ color:"#6366F1", icon:"🛎️" },
  settings:{ color:"#374151", icon:"⚙️" },
};

// ---- Langues (démarrage : Français + Anglais - les 2 langues officielles
// du Cameroun ; d'autres langues pourront être ajoutées plus tard en
// complétant simplement ce dictionnaire, sans toucher au reste du code) ----
const I18N = {
  fr: {
    welcome_title:"Bienvenue sur MERCA", welcome_sub:"SIMULATION TEST - pas de vrai SMS envoyé",
    guest_btn:"👀 Continuer sans compte (accès limité)",
    guest_note:"Sans compte : tu peux voir le catalogue avec la recherche exacte, mais pas les points de bienvenue, pas d'achat, pas d'accès à PERMUTA ni aux réservations. Inscris-toi pour tout débloquer.",
    create_account_title:"Créer un compte complet", name_placeholder:"Nom complet", phone_placeholder:"Numéro de téléphone", city_placeholder:"Ville",
    how_use_title:"Comment veux-tu utiliser MERCA ?", client_only_label:"Client uniquement", client_only_desc:"Acheter, gagner des points",
    details_title:"Détails", receive_code_btn:"Recevoir mon code par SMS", sending_code:"Envoi du code... (jusqu'à 1 min la 1ère fois, le serveur se réveille)",
    code_sent_title:"Code envoyé au", code_sim_note:"⚠️ SIMULATION TEST : aucun vrai SMS n'est encore envoyé. Le code ci-dessous a été rempli automatiquement pour tester.",
    code_placeholder:"Code à 6 chiffres", verifying:"Vérification...", validate_btn:"Valider", welcome_pts:"pts de bienvenue", edit_info_link:"← Modifier mes informations",
    lang_label:"Langue",
    home_guest_mode:"Mode Invité", home_hello:"Bonjour", home_hero_title:"Yaoundé - Prix réel d'abord", tag_simulation:"SIMULATION TEST",
    search_placeholder_exact:"Tape produit exact...", found_product_title:"Produit trouvé - Prix réel d'abord", tag_product:"Produit", tag_delivery:"Livraison",
    btn_view_product:"Voir produit", btn_alternatives:"Alternatives", guest_catalog_hint:"Mode invité : tape le nom exact d'un produit pour le trouver. La navigation par catégories et les alternatives sont réservées aux comptes inscrits.",
    catalog_title:"✨ Catalogue", services_pro_title:"SERVICES PRO", services_pro_sub:"Juridique, beauté, réparation, éducation...",
    home_client_label:"CLIENT", home_guest_label:"Invité", home_space_label:"ESPACE", home_space_sub:"Vendre / Livrer",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Simulation test", home_circle_label:"CERCLE", home_circle_sub:"Parrainage",
    home_settings_label:"PARAMÈTRES", home_settings_sub:"Compte, rôles, PIN", product_price_real:"PRIX RÉEL", product_commission_label:"Com 2%", product_total_label:"Total", out_of_stock:"Rupture de stock",
    reviews_word:"avis", product_order_btn:"Commander - SIMULATION", escrow_note:"Escrow simulé - fonds bloqués jusqu'à confirmation", confirm_title:"Confirmer", pay_label:"Payer",
    withdrawal_title:"Retrait", withdrawal_btn:"🏪 Retrait boutique", sending_label:"Envoi...", wallet_gate_desc:"Le portefeuille est réservé aux comptes inscrits", signup_btn:"S'inscrire",
    unlock_pin_title:"🔐 Déverrouiller (PIN)", unlock_btn:"Débloquer", no_order_msg:"Aucune commande", no_booking_msg:"Aucune réservation", confirm_reception_btn:"✅ Confirmer réception",
    leave_review_btn:"⭐ Laisser un avis", support_btn:"💬 Support / Signaler un problème", waiting_next_step:"⏳ En attente du commerçant/livreur pour la prochaine étape",
    support_no_messages:"Aucun message. Écris ici en cas de question sur cette commande/réservation.", support_loading:"Chargement...", message_placeholder:"Écrire un message...",
    report_problem_btn:"⚠️ Signaler un problème", dispute_describe_placeholder:"Décris le problème", send_btn:"Envoyer", cancel_btn:"Annuler", client_roles_title:"Rôles actifs",
    my_favorites_title:"❤️ Mes favoris", my_orders_title:"📦 Mes commandes", my_bookings_title:"📅 Mes réservations", permuta_title_banner:"🔄 PERMUTA - SIMULATION TEST",
    circle_my_code_title:"Ton code personnel", circle_invite_note:"Invite tes proches - quand ils font leur première vraie commande ou réservation confirmée, tu reçois",
    circle_share_btn:"📤 Partager mon code", circle_my_circle_title:"📊 Mon Cercle", circle_invited_count:"personne(s) invitée(s)", circle_active_count:"devenue(s) active(s) (première transaction confirmée)",
    settings_account_title:"👤 Mon compte", settings_no_phone:"Pas de numéro (invité)", settings_edit_info_btn:"Modifier mes informations", settings_create_account_btn:"Créer un compte complet",
    settings_appearance_title:"🎨 Apparence", settings_dark_mode:"Mode sombre", settings_notifications:"Notifications (simulation)", settings_about_title:"ℹ️ À propos",
    settings_logout_btn:"🚪 Déconnexion", settings_reset_btn:"🗑 Réinitialiser toutes les données", services_title_banner:"🧑‍💼 Tous les services disponibles", services_empty:"Aucun service publié pour l'instant",
    service_reserve_btn:"Réserver - SIMULATION", booking_slot_label:"pour le créneau", confirm_booking_title:"Confirmer la réservation", confirm_and_pay_btn:"Confirmer et payer", cancel_booking_btn:"Annuler la réservation",
    espaces_hint:"Un espace grisé veut dire que ce rôle n'est pas encore activé — active-le depuis les Paramètres.", espace_boutique_title:"Boutique (Commerçant)", espace_boutique_desc:"Vendre des produits",
    espace_livraison_title:"Livraison", espace_bureau_title:"Bureau Pro", espace_bureau_desc:"Vendre un service", espace_gate_desc:"Vendre ou livrer nécessite un compte inscrit",
    review_modal_title:"⭐ Laisser un avis", review_comment_placeholder:"Un commentaire (facultatif)", review_submit_btn:"Envoyer mon avis",
    activate_in_settings_btn:"Activer dans les Paramètres", boutique_label:"Boutique", no_reviews_yet:"Pas encore d'avis", add_product_btn:"＋ Ajouter produit", ad_fb_title:"📈 Publicité Facebook/Instagram",
    ad_fb_product_text:"Appuie sur \"📤 Partager\" sur un produit, puis dans Facebook/Instagram, choisis \"Booster cette publication\" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).",
    price_label:"Prix", stock_label:"Stock", share_btn:"📤 Partager", edit_btn:"✏️ Modifier", incoming_orders_title:"📦 Commandes reçues", no_orders_yet:"Aucune commande pour le moment.",
    next_step_btn:"➜ Étape suivante", new_product_title:"＋ Nouveau produit", price_fcfa_placeholder:"Prix (FCFA)", stock_placeholder:"Stock", publish_btn:"Publier",
    new_price_placeholder:"Nouveau prix", new_stock_placeholder:"Nouveau stock", save_btn:"Enregistrer", bureau_pro_label:"Bureau Pro", my_services_title:"Mes services", add_service_btn:"＋ Ajouter un service",
    ad_fb_service_text:"Appuie sur \"📤 Partager\" sur un service, puis dans Facebook/Instagram, choisis \"Booster cette publication\" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).",
    tariff_label:"Tarif", available_label:"Disponible", unavailable_label:"Indisponible", edit_tariff_btn:"✏️ Tarif", pause_btn:"⏸ Pause", activate_btn:"▶️ Activer",
    new_service_title:"＋ Nouveau service", service_name_placeholder:"Nom du service", tariff_fcfa_placeholder:"Tarif (FCFA)", short_desc_placeholder:"Description courte",
    edit_tariff_title:"✏️ Modifier tarif", new_tariff_placeholder:"Nouveau tarif", finish_btn:"Terminer", courier_label:"Livreur", per_delivery_suffix:"pts par livraison confirmée",
    available_deliveries_title:"📦 Livraisons disponibles", no_deliveries_available:"Aucune livraison disponible pour l'instant.", take_delivery_btn:"Prendre",
    my_current_deliveries_title:"🚚 Mes livraisons en cours", no_deliveries_in_progress:"Aucune livraison en cours.", mark_delivered_btn:"✅ Marquer livrée",
  },
  en: {
    welcome_title:"Welcome to MERCA", welcome_sub:"TEST SIMULATION - no real SMS sent yet",
    guest_btn:"👀 Continue without an account (limited access)",
    guest_note:"Without an account: you can browse the catalog with exact search, but no welcome points, no purchases, no access to PERMUTA or bookings. Sign up to unlock everything.",
    create_account_title:"Create a full account", name_placeholder:"Full name", phone_placeholder:"Phone number", city_placeholder:"City",
    how_use_title:"How do you want to use MERCA?", client_only_label:"Client only", client_only_desc:"Buy products, earn points",
    details_title:"Details", receive_code_btn:"Receive my code by SMS", sending_code:"Sending code... (up to 1 min the first time, server waking up)",
    code_sent_title:"Code sent to", code_sim_note:"⚠️ TEST SIMULATION: no real SMS sent yet. The code below was filled in automatically for testing.",
    code_placeholder:"6-digit code", verifying:"Verifying...", validate_btn:"Confirm", welcome_pts:"welcome pts", edit_info_link:"← Edit my information",
    lang_label:"Language",
    home_guest_mode:"Guest mode", home_hello:"Hello", home_hero_title:"Yaoundé - Real price first", tag_simulation:"TEST SIMULATION",
    search_placeholder_exact:"Type exact product...", found_product_title:"Product found - Real price first", tag_product:"Product", tag_delivery:"Delivery",
    btn_view_product:"View product", btn_alternatives:"Alternatives", guest_catalog_hint:"Guest mode: type the exact name of a product to find it. Category browsing and alternatives are reserved for registered accounts.",
    catalog_title:"✨ Catalog", services_pro_title:"PRO SERVICES", services_pro_sub:"Legal, beauty, repair, education...",
    home_client_label:"CLIENT", home_guest_label:"Guest", home_space_label:"SPACE", home_space_sub:"Sell / Deliver",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Test simulation", home_circle_label:"CIRCLE", home_circle_sub:"Referral",
    home_settings_label:"SETTINGS", home_settings_sub:"Account, roles, PIN", product_price_real:"REAL PRICE", product_commission_label:"Fee 2%", product_total_label:"Total", out_of_stock:"Out of stock",
    reviews_word:"reviews", product_order_btn:"Order - SIMULATION", escrow_note:"Simulated escrow - funds held until confirmation", confirm_title:"Confirm", pay_label:"Pay",
    withdrawal_title:"Pickup", withdrawal_btn:"🏪 Store pickup", sending_label:"Sending...", wallet_gate_desc:"The wallet is reserved for registered accounts", signup_btn:"Sign up",
    unlock_pin_title:"🔐 Unlock (PIN)", unlock_btn:"Unlock", no_order_msg:"No order", no_booking_msg:"No booking", confirm_reception_btn:"✅ Confirm receipt",
    leave_review_btn:"⭐ Leave a review", support_btn:"💬 Support / Report a problem", waiting_next_step:"⏳ Waiting for the merchant/courier for the next step",
    support_no_messages:"No messages. Write here if you have a question about this order/booking.", support_loading:"Loading...", message_placeholder:"Write a message...",
    report_problem_btn:"⚠️ Report a problem", dispute_describe_placeholder:"Describe the problem", send_btn:"Send", cancel_btn:"Cancel", client_roles_title:"Active roles",
    my_favorites_title:"❤️ My favorites", my_orders_title:"📦 My orders", my_bookings_title:"📅 My bookings", permuta_title_banner:"🔄 PERMUTA - TEST SIMULATION",
    circle_my_code_title:"Your personal code", circle_invite_note:"Invite your friends - when they make their first confirmed real order or booking, you get",
    circle_share_btn:"📤 Share my code", circle_my_circle_title:"📊 My Circle", circle_invited_count:"invited person(s)", circle_active_count:"became active (first confirmed transaction)",
    settings_account_title:"👤 My account", settings_no_phone:"No number (guest)", settings_edit_info_btn:"Edit my information", settings_create_account_btn:"Create a full account",
    settings_appearance_title:"🎨 Appearance", settings_dark_mode:"Dark mode", settings_notifications:"Notifications (simulation)", settings_about_title:"ℹ️ About",
    settings_logout_btn:"🚪 Log out", settings_reset_btn:"🗑 Reset all data", services_title_banner:"🧑‍💼 All available services", services_empty:"No service published yet",
    service_reserve_btn:"Book - SIMULATION", booking_slot_label:"for the slot", confirm_booking_title:"Confirm the booking", confirm_and_pay_btn:"Confirm and pay", cancel_booking_btn:"Cancel the booking",
    espaces_hint:"A greyed-out space means this role isn't activated yet — activate it from Settings.", espace_boutique_title:"Shop (Merchant)", espace_boutique_desc:"Sell products",
    espace_livraison_title:"Delivery", espace_bureau_title:"Pro Office", espace_bureau_desc:"Sell a service", espace_gate_desc:"Selling or delivering requires a registered account",
    review_modal_title:"⭐ Leave a review", review_comment_placeholder:"A comment (optional)", review_submit_btn:"Send my review",
    activate_in_settings_btn:"Activate in Settings", boutique_label:"Shop", no_reviews_yet:"No reviews yet", add_product_btn:"＋ Add product", ad_fb_title:"📈 Facebook/Instagram Ads",
    ad_fb_product_text:"Tap \"📤 Share\" on a product, then in Facebook/Instagram, choose \"Boost this post\" to reach more customers (budget and payment handled directly by you on Facebook).",
    price_label:"Price", stock_label:"Stock", share_btn:"📤 Share", edit_btn:"✏️ Edit", incoming_orders_title:"📦 Received orders", no_orders_yet:"No orders yet.",
    next_step_btn:"➜ Next step", new_product_title:"＋ New product", price_fcfa_placeholder:"Price (FCFA)", stock_placeholder:"Stock", publish_btn:"Publish",
    new_price_placeholder:"New price", new_stock_placeholder:"New stock", save_btn:"Save", bureau_pro_label:"Pro Office", my_services_title:"My services", add_service_btn:"＋ Add a service",
    ad_fb_service_text:"Tap \"📤 Share\" on a service, then in Facebook/Instagram, choose \"Boost this post\" to reach more customers (budget and payment handled directly by you on Facebook).",
    tariff_label:"Rate", available_label:"Available", unavailable_label:"Unavailable", edit_tariff_btn:"✏️ Rate", pause_btn:"⏸ Pause", activate_btn:"▶️ Activate",
    new_service_title:"＋ New service", service_name_placeholder:"Service name", tariff_fcfa_placeholder:"Rate (FCFA)", short_desc_placeholder:"Short description",
    edit_tariff_title:"✏️ Edit rate", new_tariff_placeholder:"New rate", finish_btn:"Finish", courier_label:"Courier", per_delivery_suffix:"pts per confirmed delivery",
    available_deliveries_title:"📦 Available deliveries", no_deliveries_available:"No delivery available right now.", take_delivery_btn:"Take",
    my_current_deliveries_title:"🚚 My current deliveries", no_deliveries_in_progress:"No delivery in progress.", mark_delivered_btn:"✅ Mark delivered",
  },
  es: {
    welcome_title:"Bienvenido a MERCA", welcome_sub:"SIMULACIÓN DE PRUEBA - aún no se envía SMS real",
    guest_btn:"👀 Continuar sin cuenta (acceso limitado)",
    guest_note:"Sin cuenta: puedes ver el catálogo con búsqueda exacta, pero sin puntos de bienvenida, sin compras, sin acceso a PERMUTA ni a las reservas. Regístrate para desbloquear todo.",
    create_account_title:"Crear una cuenta completa", name_placeholder:"Nombre completo", phone_placeholder:"Número de teléfono", city_placeholder:"Ciudad",
    how_use_title:"¿Cómo quieres usar MERCA?", client_only_label:"Solo cliente", client_only_desc:"Comprar, ganar puntos",
    details_title:"Detalles", receive_code_btn:"Recibir mi código por SMS", sending_code:"Enviando código... (hasta 1 min la primera vez, el servidor se está despertando)",
    code_sent_title:"Código enviado a", code_sim_note:"⚠️ SIMULACIÓN DE PRUEBA: aún no se envía ningún SMS real. El código de abajo se rellenó automáticamente para probar.",
    code_placeholder:"Código de 6 dígitos", verifying:"Verificando...", validate_btn:"Confirmar", welcome_pts:"pts de bienvenida", edit_info_link:"← Editar mi información",
    lang_label:"Idioma",
    home_guest_mode:"Modo invitado", home_hello:"Hola", home_hero_title:"Yaoundé - Precio real primero", tag_simulation:"SIMULACIÓN DE PRUEBA",
    search_placeholder_exact:"Escribe el producto exacto...", found_product_title:"Producto encontrado - Precio real primero", tag_product:"Producto", tag_delivery:"Entrega",
    btn_view_product:"Ver producto", btn_alternatives:"Alternativas", guest_catalog_hint:"Modo invitado: escribe el nombre exacto de un producto para encontrarlo. La navegación por categorías y las alternativas están reservadas para cuentas registradas.",
    catalog_title:"✨ Catálogo", services_pro_title:"SERVICIOS PRO", services_pro_sub:"Legal, belleza, reparación, educación...",
    home_client_label:"CLIENTE", home_guest_label:"Invitado", home_space_label:"ESPACIO", home_space_sub:"Vender / Entregar",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Simulación de prueba", home_circle_label:"CÍRCULO", home_circle_sub:"Referidos",
    home_settings_label:"AJUSTES", home_settings_sub:"Cuenta, roles, PIN", product_price_real:"PRECIO REAL", product_commission_label:"Comisión 2%", product_total_label:"Total", out_of_stock:"Agotado",
    reviews_word:"reseñas", product_order_btn:"Pedir - SIMULACIÓN", escrow_note:"Depósito simulado - fondos retenidos hasta la confirmación", confirm_title:"Confirmar", pay_label:"Pagar",
    withdrawal_title:"Retiro", withdrawal_btn:"🏪 Retiro en tienda", sending_label:"Enviando...", wallet_gate_desc:"El monedero está reservado para cuentas registradas", signup_btn:"Registrarse",
    unlock_pin_title:"🔐 Desbloquear (PIN)", unlock_btn:"Desbloquear", no_order_msg:"Ningún pedido", no_booking_msg:"Ninguna reserva", confirm_reception_btn:"✅ Confirmar recepción",
    leave_review_btn:"⭐ Dejar una reseña", support_btn:"💬 Soporte / Reportar un problema", waiting_next_step:"⏳ Esperando al comerciante/repartidor para el siguiente paso",
    support_no_messages:"Sin mensajes. Escribe aquí si tienes una pregunta sobre este pedido/reserva.", support_loading:"Cargando...", message_placeholder:"Escribe un mensaje...",
    report_problem_btn:"⚠️ Reportar un problema", dispute_describe_placeholder:"Describe el problema", send_btn:"Enviar", cancel_btn:"Cancelar", client_roles_title:"Roles activos",
    my_favorites_title:"❤️ Mis favoritos", my_orders_title:"📦 Mis pedidos", my_bookings_title:"📅 Mis reservas", permuta_title_banner:"🔄 PERMUTA - SIMULACIÓN DE PRUEBA",
    circle_my_code_title:"Tu código personal", circle_invite_note:"Invita a tus amigos - cuando hagan su primer pedido o reserva real confirmada, recibes",
    circle_share_btn:"📤 Compartir mi código", circle_my_circle_title:"📊 Mi Círculo", circle_invited_count:"persona(s) invitada(s)", circle_active_count:"se volvieron activas (primera transacción confirmada)",
    settings_account_title:"👤 Mi cuenta", settings_no_phone:"Sin número (invitado)", settings_edit_info_btn:"Editar mi información", settings_create_account_btn:"Crear una cuenta completa",
    settings_appearance_title:"🎨 Apariencia", settings_dark_mode:"Modo oscuro", settings_notifications:"Notificaciones (simulación)", settings_about_title:"ℹ️ Acerca de",
    settings_logout_btn:"🚪 Cerrar sesión", settings_reset_btn:"🗑 Restablecer todos los datos", services_title_banner:"🧑‍💼 Todos los servicios disponibles", services_empty:"Aún no hay ningún servicio publicado",
    service_reserve_btn:"Reservar - SIMULACIÓN", booking_slot_label:"para el horario", confirm_booking_title:"Confirmar la reserva", confirm_and_pay_btn:"Confirmar y pagar", cancel_booking_btn:"Cancelar la reserva",
    espaces_hint:"Un espacio en gris significa que este rol aún no está activado — actívalo desde Ajustes.", espace_boutique_title:"Tienda (Comerciante)", espace_boutique_desc:"Vender productos",
    espace_livraison_title:"Entrega", espace_bureau_title:"Oficina Pro", espace_bureau_desc:"Vender un servicio", espace_gate_desc:"Vender o entregar requiere una cuenta registrada",
    review_modal_title:"⭐ Dejar una reseña", review_comment_placeholder:"Un comentario (opcional)", review_submit_btn:"Enviar mi reseña",
    activate_in_settings_btn:"Activar en Ajustes", boutique_label:"Tienda", no_reviews_yet:"Aún sin reseñas", add_product_btn:"＋ Añadir producto", ad_fb_title:"📈 Publicidad en Facebook/Instagram",
    ad_fb_product_text:"Pulsa \"📤 Compartir\" en un producto, luego en Facebook/Instagram elige \"Promocionar esta publicación\" para llegar a más clientes (presupuesto y pago gestionados directamente por ti en Facebook).",
    price_label:"Precio", stock_label:"Stock", share_btn:"📤 Compartir", edit_btn:"✏️ Editar", incoming_orders_title:"📦 Pedidos recibidos", no_orders_yet:"Ningún pedido por ahora.",
    next_step_btn:"➜ Siguiente paso", new_product_title:"＋ Nuevo producto", price_fcfa_placeholder:"Precio (FCFA)", stock_placeholder:"Stock", publish_btn:"Publicar",
    new_price_placeholder:"Nuevo precio", new_stock_placeholder:"Nuevo stock", save_btn:"Guardar", bureau_pro_label:"Oficina Pro", my_services_title:"Mis servicios", add_service_btn:"＋ Añadir un servicio",
    ad_fb_service_text:"Pulsa \"📤 Compartir\" en un servicio, luego en Facebook/Instagram elige \"Promocionar esta publicación\" para llegar a más clientes (presupuesto y pago gestionados directamente por ti en Facebook).",
    tariff_label:"Tarifa", available_label:"Disponible", unavailable_label:"No disponible", edit_tariff_btn:"✏️ Tarifa", pause_btn:"⏸ Pausar", activate_btn:"▶️ Activar",
    new_service_title:"＋ Nuevo servicio", service_name_placeholder:"Nombre del servicio", tariff_fcfa_placeholder:"Tarifa (FCFA)", short_desc_placeholder:"Descripción corta",
    edit_tariff_title:"✏️ Editar tarifa", new_tariff_placeholder:"Nueva tarifa", finish_btn:"Terminar", courier_label:"Repartidor", per_delivery_suffix:"pts por entrega confirmada",
    available_deliveries_title:"📦 Entregas disponibles", no_deliveries_available:"Ninguna entrega disponible por ahora.", take_delivery_btn:"Tomar",
    my_current_deliveries_title:"🚚 Mis entregas en curso", no_deliveries_in_progress:"Ninguna entrega en curso.", mark_delivered_btn:"✅ Marcar entregado",
  },
  pt: {
    welcome_title:"Bem-vindo ao MERCA", welcome_sub:"SIMULAÇÃO DE TESTE - nenhum SMS real enviado ainda",
    guest_btn:"👀 Continuar sem conta (acesso limitado)",
    guest_note:"Sem conta: podes ver o catálogo com pesquisa exata, mas sem pontos de boas-vindas, sem compras, sem acesso ao PERMUTA nem às reservas. Regista-te para desbloquear tudo.",
    create_account_title:"Criar uma conta completa", name_placeholder:"Nome completo", phone_placeholder:"Número de telefone", city_placeholder:"Cidade",
    how_use_title:"Como queres usar o MERCA?", client_only_label:"Apenas cliente", client_only_desc:"Comprar, ganhar pontos",
    details_title:"Detalhes", receive_code_btn:"Receber o meu código por SMS", sending_code:"A enviar o código... (até 1 min na primeira vez, o servidor está a acordar)",
    code_sent_title:"Código enviado para", code_sim_note:"⚠️ SIMULAÇÃO DE TESTE: nenhum SMS real enviado ainda. O código abaixo foi preenchido automaticamente para teste.",
    code_placeholder:"Código de 6 dígitos", verifying:"A verificar...", validate_btn:"Confirmar", welcome_pts:"pts de boas-vindas", edit_info_link:"← Editar as minhas informações",
    lang_label:"Idioma",
    home_guest_mode:"Modo convidado", home_hello:"Olá", home_hero_title:"Yaoundé - Preço real primeiro", tag_simulation:"SIMULAÇÃO DE TESTE",
    search_placeholder_exact:"Digite o produto exato...", found_product_title:"Produto encontrado - Preço real primeiro", tag_product:"Produto", tag_delivery:"Entrega",
    btn_view_product:"Ver produto", btn_alternatives:"Alternativas", guest_catalog_hint:"Modo convidado: digite o nome exato de um produto para encontrá-lo. A navegação por categorias e as alternativas são reservadas para contas registadas.",
    catalog_title:"✨ Catálogo", services_pro_title:"SERVIÇOS PRO", services_pro_sub:"Jurídico, beleza, reparação, educação...",
    home_client_label:"CLIENTE", home_guest_label:"Convidado", home_space_label:"ESPAÇO", home_space_sub:"Vender / Entregar",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Simulação de teste", home_circle_label:"CÍRCULO", home_circle_sub:"Indicação",
    home_settings_label:"DEFINIÇÕES", home_settings_sub:"Conta, funções, PIN", product_price_real:"PREÇO REAL", product_commission_label:"Taxa 2%", product_total_label:"Total", out_of_stock:"Esgotado",
    reviews_word:"avaliações", product_order_btn:"Encomendar - SIMULAÇÃO", escrow_note:"Depósito simulado - fundos retidos até a confirmação", confirm_title:"Confirmar", pay_label:"Pagar",
    withdrawal_title:"Levantamento", withdrawal_btn:"🏪 Levantamento na loja", sending_label:"A enviar...", wallet_gate_desc:"A carteira é reservada para contas registadas", signup_btn:"Registar-se",
    unlock_pin_title:"🔐 Desbloquear (PIN)", unlock_btn:"Desbloquear", no_order_msg:"Nenhuma encomenda", no_booking_msg:"Nenhuma reserva", confirm_reception_btn:"✅ Confirmar receção",
    leave_review_btn:"⭐ Deixar uma avaliação", support_btn:"💬 Suporte / Reportar um problema", waiting_next_step:"⏳ A aguardar o comerciante/estafeta para a próxima etapa",
    support_no_messages:"Sem mensagens. Escreve aqui se tiveres alguma dúvida sobre esta encomenda/reserva.", support_loading:"A carregar...", message_placeholder:"Escrever uma mensagem...",
    report_problem_btn:"⚠️ Reportar um problema", dispute_describe_placeholder:"Descreve o problema", send_btn:"Enviar", cancel_btn:"Cancelar", client_roles_title:"Funções ativas",
    my_favorites_title:"❤️ Os meus favoritos", my_orders_title:"📦 As minhas encomendas", my_bookings_title:"📅 As minhas reservas", permuta_title_banner:"🔄 PERMUTA - SIMULAÇÃO DE TESTE",
    circle_my_code_title:"O teu código pessoal", circle_invite_note:"Convida os teus amigos - quando fizerem a primeira encomenda ou reserva real confirmada, recebes",
    circle_share_btn:"📤 Partilhar o meu código", circle_my_circle_title:"📊 O Meu Círculo", circle_invited_count:"pessoa(s) convidada(s)", circle_active_count:"tornaram-se ativas (primeira transação confirmada)",
    settings_account_title:"👤 A minha conta", settings_no_phone:"Sem número (convidado)", settings_edit_info_btn:"Editar as minhas informações", settings_create_account_btn:"Criar uma conta completa",
    settings_appearance_title:"🎨 Aparência", settings_dark_mode:"Modo escuro", settings_notifications:"Notificações (simulação)", settings_about_title:"ℹ️ Acerca de",
    settings_logout_btn:"🚪 Terminar sessão", settings_reset_btn:"🗑 Repor todos os dados", services_title_banner:"🧑‍💼 Todos os serviços disponíveis", services_empty:"Ainda não há nenhum serviço publicado",
    service_reserve_btn:"Reservar - SIMULAÇÃO", booking_slot_label:"para o horário", confirm_booking_title:"Confirmar a reserva", confirm_and_pay_btn:"Confirmar e pagar", cancel_booking_btn:"Cancelar a reserva",
    espaces_hint:"Um espaço acinzentado significa que esta função ainda não está ativada — ativa-a nas Definições.", espace_boutique_title:"Loja (Comerciante)", espace_boutique_desc:"Vender produtos",
    espace_livraison_title:"Entrega", espace_bureau_title:"Escritório Pro", espace_bureau_desc:"Vender um serviço", espace_gate_desc:"Vender ou entregar requer uma conta registada",
    review_modal_title:"⭐ Deixar uma avaliação", review_comment_placeholder:"Um comentário (opcional)", review_submit_btn:"Enviar a minha avaliação",
    activate_in_settings_btn:"Ativar nas Definições", boutique_label:"Loja", no_reviews_yet:"Ainda sem avaliações", add_product_btn:"＋ Adicionar produto", ad_fb_title:"📈 Publicidade no Facebook/Instagram",
    ad_fb_product_text:"Toca em \"📤 Partilhar\" num produto e, no Facebook/Instagram, escolhe \"Impulsionar esta publicação\" para alcançar mais clientes (orçamento e pagamento geridos diretamente por ti no Facebook).",
    price_label:"Preço", stock_label:"Stock", share_btn:"📤 Partilhar", edit_btn:"✏️ Editar", incoming_orders_title:"📦 Encomendas recebidas", no_orders_yet:"Nenhuma encomenda por agora.",
    next_step_btn:"➜ Próxima etapa", new_product_title:"＋ Novo produto", price_fcfa_placeholder:"Preço (FCFA)", stock_placeholder:"Stock", publish_btn:"Publicar",
    new_price_placeholder:"Novo preço", new_stock_placeholder:"Novo stock", save_btn:"Guardar", bureau_pro_label:"Escritório Pro", my_services_title:"Os meus serviços", add_service_btn:"＋ Adicionar um serviço",
    ad_fb_service_text:"Toca em \"📤 Partilhar\" num serviço e, no Facebook/Instagram, escolhe \"Impulsionar esta publicação\" para alcançar mais clientes (orçamento e pagamento geridos diretamente por ti no Facebook).",
    tariff_label:"Tarifa", available_label:"Disponível", unavailable_label:"Indisponível", edit_tariff_btn:"✏️ Tarifa", pause_btn:"⏸ Pausar", activate_btn:"▶️ Ativar",
    new_service_title:"＋ Novo serviço", service_name_placeholder:"Nome do serviço", tariff_fcfa_placeholder:"Tarifa (FCFA)", short_desc_placeholder:"Descrição curta",
    edit_tariff_title:"✏️ Editar tarifa", new_tariff_placeholder:"Nova tarifa", finish_btn:"Terminar", courier_label:"Entregador", per_delivery_suffix:"pts por entrega confirmada",
    available_deliveries_title:"📦 Entregas disponíveis", no_deliveries_available:"Nenhuma entrega disponível por agora.", take_delivery_btn:"Aceitar",
    my_current_deliveries_title:"🚚 As minhas entregas em curso", no_deliveries_in_progress:"Nenhuma entrega em curso.", mark_delivered_btn:"✅ Marcar como entregue",
  },
  ar: {
    welcome_title:"مرحبًا بك في MERCA", welcome_sub:"محاكاة اختبار - لم يتم إرسال رسالة SMS حقيقية بعد",
    guest_btn:"👀 المتابعة بدون حساب (وصول محدود)",
    guest_note:"بدون حساب: يمكنك تصفح الكتالوج بالبحث الدقيق فقط، دون نقاط ترحيبية أو شراء أو الوصول إلى PERMUTA أو الحجوزات. سجّل لفتح كل شيء.",
    create_account_title:"إنشاء حساب كامل", name_placeholder:"الاسم الكامل", phone_placeholder:"رقم الهاتف", city_placeholder:"المدينة",
    how_use_title:"كيف تريد استخدام MERCA؟", client_only_label:"عميل فقط", client_only_desc:"الشراء وكسب النقاط",
    details_title:"التفاصيل", receive_code_btn:"استلام رمزي عبر SMS", sending_code:"جارٍ إرسال الرمز... (حتى دقيقة واحدة في المرة الأولى، الخادم يستيقظ)",
    code_sent_title:"تم إرسال الرمز إلى", code_sim_note:"⚠️ محاكاة اختبار: لم يتم إرسال أي رسالة SMS حقيقية بعد. تم ملء الرمز أدناه تلقائيًا للاختبار.",
    code_placeholder:"رمز مكوّن من 6 أرقام", verifying:"جارٍ التحقق...", validate_btn:"تأكيد", welcome_pts:"نقاط ترحيبية", edit_info_link:"← تعديل معلوماتي",
    lang_label:"اللغة",
    home_guest_mode:"وضع الزائر", home_hello:"مرحبًا", home_hero_title:"ياوندي - السعر الحقيقي أولاً", tag_simulation:"محاكاة اختبار",
    search_placeholder_exact:"اكتب اسم المنتج بالضبط...", found_product_title:"تم العثور على المنتج - السعر الحقيقي أولاً", tag_product:"المنتج", tag_delivery:"التوصيل",
    btn_view_product:"عرض المنتج", btn_alternatives:"بدائل", guest_catalog_hint:"وضع الزائر: اكتب الاسم الدقيق لمنتج للعثور عليه. التصفح حسب الفئات والبدائل مخصصة للحسابات المسجلة.",
    catalog_title:"✨ الكتالوج", services_pro_title:"خدمات احترافية", services_pro_sub:"قانوني، تجميل، إصلاح، تعليم...",
    home_client_label:"عميل", home_guest_label:"زائر", home_space_label:"مساحة", home_space_sub:"بيع / توصيل",
    home_permuta_label:"PERMUTA", home_permuta_sub:"محاكاة اختبار", home_circle_label:"الدائرة", home_circle_sub:"الإحالة",
    home_settings_label:"الإعدادات", home_settings_sub:"الحساب، الأدوار، الرمز السري", product_price_real:"السعر الحقيقي", product_commission_label:"عمولة 2%", product_total_label:"الإجمالي", out_of_stock:"نفدت الكمية",
    reviews_word:"تقييمات", product_order_btn:"اطلب - محاكاة", escrow_note:"ضمان محاكى - الأموال محتجزة حتى التأكيد", confirm_title:"تأكيد", pay_label:"ادفع",
    withdrawal_title:"استلام", withdrawal_btn:"🏪 استلام من المتجر", sending_label:"جارٍ الإرسال...", wallet_gate_desc:"المحفظة مخصصة للحسابات المسجلة", signup_btn:"التسجيل",
    unlock_pin_title:"🔐 فتح القفل (رمز سري)", unlock_btn:"فتح القفل", no_order_msg:"لا يوجد طلب", no_booking_msg:"لا يوجد حجز", confirm_reception_btn:"✅ تأكيد الاستلام",
    leave_review_btn:"⭐ ترك تقييم", support_btn:"💬 الدعم / الإبلاغ عن مشكلة", waiting_next_step:"⏳ في انتظار التاجر/السائق للخطوة التالية",
    support_no_messages:"لا توجد رسائل. اكتب هنا إذا كان لديك سؤال حول هذا الطلب/الحجز.", support_loading:"جارٍ التحميل...", message_placeholder:"اكتب رسالة...",
    report_problem_btn:"⚠️ الإبلاغ عن مشكلة", dispute_describe_placeholder:"صف المشكلة", send_btn:"إرسال", cancel_btn:"إلغاء", client_roles_title:"الأدوار النشطة",
    my_favorites_title:"❤️ المفضلة لدي", my_orders_title:"📦 طلباتي", my_bookings_title:"📅 حجوزاتي", permuta_title_banner:"🔄 PERMUTA - محاكاة اختبار",
    circle_my_code_title:"رمزك الشخصي", circle_invite_note:"ادعُ أصدقاءك - عندما يقومون بأول طلب أو حجز حقيقي مؤكد، تحصل على",
    circle_share_btn:"📤 مشاركة رمزي", circle_my_circle_title:"📊 دائرتي", circle_invited_count:"شخص (أشخاص) مدعو(ون)", circle_active_count:"أصبحوا نشطين (أول معاملة مؤكدة)",
    settings_account_title:"👤 حسابي", settings_no_phone:"لا يوجد رقم (زائر)", settings_edit_info_btn:"تعديل معلوماتي", settings_create_account_btn:"إنشاء حساب كامل",
    settings_appearance_title:"🎨 المظهر", settings_dark_mode:"الوضع الداكن", settings_notifications:"الإشعارات (محاكاة)", settings_about_title:"ℹ️ حول",
    settings_logout_btn:"🚪 تسجيل الخروج", settings_reset_btn:"🗑 إعادة تعيين جميع البيانات", services_title_banner:"🧑‍💼 جميع الخدمات المتاحة", services_empty:"لا توجد خدمة منشورة بعد",
    service_reserve_btn:"احجز - محاكاة", booking_slot_label:"للموعد", confirm_booking_title:"تأكيد الحجز", confirm_and_pay_btn:"تأكيد والدفع", cancel_booking_btn:"إلغاء الحجز",
    espaces_hint:"المساحة الرمادية تعني أن هذا الدور لم يتم تفعيله بعد — فعّله من الإعدادات.", espace_boutique_title:"متجر (تاجر)", espace_boutique_desc:"بيع المنتجات",
    espace_livraison_title:"التوصيل", espace_bureau_title:"مكتب احترافي", espace_bureau_desc:"بيع خدمة", espace_gate_desc:"البيع أو التوصيل يتطلب حسابًا مسجلاً",
    review_modal_title:"⭐ ترك تقييم", review_comment_placeholder:"تعليق (اختياري)", review_submit_btn:"إرسال تقييمي",
    activate_in_settings_btn:"فعّل من الإعدادات", boutique_label:"متجر", no_reviews_yet:"لا توجد تقييمات بعد", add_product_btn:"＋ إضافة منتج", ad_fb_title:"📈 إعلانات فيسبوك/إنستغرام",
    ad_fb_product_text:"اضغط على \"📤 مشاركة\" على منتج، ثم في فيسبوك/إنستغرام اختر \"تعزيز هذا المنشور\" للوصول إلى مزيد من العملاء (الميزانية والدفع يتم التعامل معهما مباشرة بواسطتك على فيسبوك).",
    price_label:"السعر", stock_label:"المخزون", share_btn:"📤 مشاركة", edit_btn:"✏️ تعديل", incoming_orders_title:"📦 الطلبات الواردة", no_orders_yet:"لا توجد طلبات حتى الآن.",
    next_step_btn:"➜ الخطوة التالية", new_product_title:"＋ منتج جديد", price_fcfa_placeholder:"السعر (فرنك)", stock_placeholder:"المخزون", publish_btn:"نشر",
    new_price_placeholder:"سعر جديد", new_stock_placeholder:"مخزون جديد", save_btn:"حفظ", bureau_pro_label:"مكتب احترافي", my_services_title:"خدماتي", add_service_btn:"＋ إضافة خدمة",
    ad_fb_service_text:"اضغط على \"📤 مشاركة\" على خدمة، ثم في فيسبوك/إنستغرام اختر \"تعزيز هذا المنشور\" للوصول إلى مزيد من العملاء (الميزانية والدفع يتم التعامل معهما مباشرة بواسطتك على فيسبوك).",
    tariff_label:"التعريفة", available_label:"متاح", unavailable_label:"غير متاح", edit_tariff_btn:"✏️ التعريفة", pause_btn:"⏸ إيقاف مؤقت", activate_btn:"▶️ تفعيل",
    new_service_title:"＋ خدمة جديدة", service_name_placeholder:"اسم الخدمة", tariff_fcfa_placeholder:"التعريفة (فرنك)", short_desc_placeholder:"وصف قصير",
    edit_tariff_title:"✏️ تعديل التعريفة", new_tariff_placeholder:"تعريفة جديدة", finish_btn:"إنهاء", courier_label:"السائق", per_delivery_suffix:"نقطة لكل توصيل مؤكد",
    available_deliveries_title:"📦 التوصيلات المتاحة", no_deliveries_available:"لا يوجد توصيل متاح حاليًا.", take_delivery_btn:"أخذ",
    my_current_deliveries_title:"🚚 توصيلاتي الجارية", no_deliveries_in_progress:"لا يوجد توصيل جارٍ.", mark_delivered_btn:"✅ تحديد كموصّل",
  },
  zh: {
    welcome_title:"欢迎使用 MERCA", welcome_sub:"测试模拟 - 尚未发送真实短信",
    guest_btn:"👀 不注册继续使用（访问受限）",
    guest_note:"无账号：你可以浏览目录并使用精确搜索，但没有欢迎积分、无法购买、无法使用PERMUTA或预约功能。注册以解锁全部功能。",
    create_account_title:"创建完整账号", name_placeholder:"全名", phone_placeholder:"电话号码", city_placeholder:"城市",
    how_use_title:"你想如何使用MERCA？", client_only_label:"仅作为客户", client_only_desc:"购买商品，赚取积分",
    details_title:"详情", receive_code_btn:"通过短信接收验证码", sending_code:"正在发送验证码...（首次可能需要长达1分钟，服务器正在启动）",
    code_sent_title:"验证码已发送至", code_sim_note:"⚠️ 测试模拟：尚未发送真实短信。以下验证码已自动填写以供测试。",
    code_placeholder:"6位数验证码", verifying:"正在验证...", validate_btn:"确认", welcome_pts:"欢迎积分", edit_info_link:"← 编辑我的信息",
    lang_label:"语言",
    home_guest_mode:"访客模式", home_hello:"你好", home_hero_title:"雅温得 - 真实价格优先", tag_simulation:"测试模拟",
    search_placeholder_exact:"输入精确商品名称...", found_product_title:"找到商品 - 真实价格优先", tag_product:"商品", tag_delivery:"配送",
    btn_view_product:"查看商品", btn_alternatives:"替代选项", guest_catalog_hint:"访客模式：输入商品的精确名称以查找它。分类浏览和替代选项仅限注册账号使用。",
    catalog_title:"✨ 目录", services_pro_title:"专业服务", services_pro_sub:"法律、美容、维修、教育...",
    home_client_label:"客户", home_guest_label:"访客", home_space_label:"空间", home_space_sub:"出售 / 配送",
    home_permuta_label:"PERMUTA", home_permuta_sub:"测试模拟", home_circle_label:"圈子", home_circle_sub:"推荐",
    home_settings_label:"设置", home_settings_sub:"账户、角色、密码", product_price_real:"真实价格", product_commission_label:"佣金2%", product_total_label:"总计", out_of_stock:"缺货",
    reviews_word:"评价", product_order_btn:"下单 - 模拟", escrow_note:"模拟担保 - 资金在确认前被冻结", confirm_title:"确认", pay_label:"支付",
    withdrawal_title:"取货", withdrawal_btn:"🏪 到店取货", sending_label:"发送中...", wallet_gate_desc:"钱包仅限注册账号使用", signup_btn:"注册",
    unlock_pin_title:"🔐 解锁（密码）", unlock_btn:"解锁", no_order_msg:"没有订单", no_booking_msg:"没有预约", confirm_reception_btn:"✅ 确认收货",
    leave_review_btn:"⭐ 留下评价", support_btn:"💬 客服 / 举报问题", waiting_next_step:"⏳ 等待商家/配送员进行下一步",
    support_no_messages:"暂无消息。如对此订单/预约有疑问，请在此留言。", support_loading:"加载中...", message_placeholder:"输入消息...",
    report_problem_btn:"⚠️ 举报问题", dispute_describe_placeholder:"描述问题", send_btn:"发送", cancel_btn:"取消", client_roles_title:"已激活的角色",
    my_favorites_title:"❤️ 我的收藏", my_orders_title:"📦 我的订单", my_bookings_title:"📅 我的预约", permuta_title_banner:"🔄 PERMUTA - 测试模拟",
    circle_my_code_title:"你的专属代码", circle_invite_note:"邀请朋友 - 当他们完成首次确认的真实订单或预约后，你将获得",
    circle_share_btn:"📤 分享我的代码", circle_my_circle_title:"📊 我的圈子", circle_invited_count:"位受邀人", circle_active_count:"已激活（首次确认交易）",
    settings_account_title:"👤 我的账户", settings_no_phone:"无号码（访客）", settings_edit_info_btn:"编辑我的信息", settings_create_account_btn:"创建完整账号",
    settings_appearance_title:"🎨 外观", settings_dark_mode:"深色模式", settings_notifications:"通知（模拟）", settings_about_title:"ℹ️ 关于",
    settings_logout_btn:"🚪 退出登录", settings_reset_btn:"🗑 重置所有数据", services_title_banner:"🧑‍💼 所有可用服务", services_empty:"暂无发布的服务",
    service_reserve_btn:"预约 - 模拟", booking_slot_label:"时段", confirm_booking_title:"确认预约", confirm_and_pay_btn:"确认并支付", cancel_booking_btn:"取消预约",
    espaces_hint:"灰色空间表示该角色尚未激活 — 请在设置中激活。", espace_boutique_title:"店铺（商家）", espace_boutique_desc:"出售商品",
    espace_livraison_title:"配送", espace_bureau_title:"专业办公室", espace_bureau_desc:"出售服务", espace_gate_desc:"出售或配送需要注册账号",
    review_modal_title:"⭐ 留下评价", review_comment_placeholder:"评论（可选）", review_submit_btn:"发送我的评价",
    activate_in_settings_btn:"在设置中激活", boutique_label:"店铺", no_reviews_yet:"暂无评价", add_product_btn:"＋ 添加产品", ad_fb_title:"📈 Facebook/Instagram 广告",
    ad_fb_product_text:"点击产品上的\"📤 分享\"，然后在 Facebook/Instagram 中选择\"推广此帖子\"以吸引更多客户（预算和付款由你直接在 Facebook 上管理）。",
    price_label:"价格", stock_label:"库存", share_btn:"📤 分享", edit_btn:"✏️ 编辑", incoming_orders_title:"📦 收到的订单", no_orders_yet:"暂无订单。",
    next_step_btn:"➜ 下一步", new_product_title:"＋ 新产品", price_fcfa_placeholder:"价格 (FCFA)", stock_placeholder:"库存", publish_btn:"发布",
    new_price_placeholder:"新价格", new_stock_placeholder:"新库存", save_btn:"保存", bureau_pro_label:"专业办公室", my_services_title:"我的服务", add_service_btn:"＋ 添加服务",
    ad_fb_service_text:"点击服务上的\"📤 分享\"，然后在 Facebook/Instagram 中选择\"推广此帖子\"以吸引更多客户（预算和付款由你直接在 Facebook 上管理）。",
    tariff_label:"费率", available_label:"可用", unavailable_label:"不可用", edit_tariff_btn:"✏️ 费率", pause_btn:"⏸ 暂停", activate_btn:"▶️ 启用",
    new_service_title:"＋ 新服务", service_name_placeholder:"服务名称", tariff_fcfa_placeholder:"费率 (FCFA)", short_desc_placeholder:"简短描述",
    edit_tariff_title:"✏️ 编辑费率", new_tariff_placeholder:"新费率", finish_btn:"完成", courier_label:"配送员", per_delivery_suffix:"积分/每次确认配送",
    available_deliveries_title:"📦 可接订单", no_deliveries_available:"目前没有可用的配送。", take_delivery_btn:"接单",
    my_current_deliveries_title:"🚚 我正在配送的订单", no_deliveries_in_progress:"没有正在进行的配送。", mark_delivered_btn:"✅ 标记为已送达",
  },
  de: {
    welcome_title:"Willkommen bei MERCA", welcome_sub:"TESTSIMULATION - noch keine echte SMS gesendet",
    guest_btn:"👀 Ohne Konto fortfahren (eingeschränkter Zugriff)",
    guest_note:"Ohne Konto: Du kannst den Katalog mit exakter Suche durchsuchen, aber keine Willkommenspunkte, keine Käufe, kein Zugriff auf PERMUTA oder Buchungen. Registriere dich, um alles freizuschalten.",
    create_account_title:"Vollständiges Konto erstellen", name_placeholder:"Vollständiger Name", phone_placeholder:"Telefonnummer", city_placeholder:"Stadt",
    how_use_title:"Wie möchtest du MERCA nutzen?", client_only_label:"Nur Kunde", client_only_desc:"Kaufen, Punkte sammeln",
    details_title:"Details", receive_code_btn:"Code per SMS erhalten", sending_code:"Code wird gesendet... (beim ersten Mal bis zu 1 Min., der Server wacht auf)",
    code_sent_title:"Code gesendet an", code_sim_note:"⚠️ TESTSIMULATION: Es wurde noch keine echte SMS gesendet. Der Code unten wurde automatisch zum Testen eingetragen.",
    code_placeholder:"6-stelliger Code", verifying:"Wird überprüft...", validate_btn:"Bestätigen", welcome_pts:"Willkommenspunkte", edit_info_link:"← Meine Informationen bearbeiten",
    lang_label:"Sprache",
    home_guest_mode:"Gastmodus", home_hello:"Hallo", home_hero_title:"Yaoundé - Echter Preis zuerst", tag_simulation:"TESTSIMULATION",
    search_placeholder_exact:"Genaues Produkt eingeben...", found_product_title:"Produkt gefunden - Echter Preis zuerst", tag_product:"Produkt", tag_delivery:"Lieferung",
    btn_view_product:"Produkt ansehen", btn_alternatives:"Alternativen", guest_catalog_hint:"Gastmodus: Gib den genauen Namen eines Produkts ein, um es zu finden. Das Durchsuchen nach Kategorien und Alternativen ist registrierten Konten vorbehalten.",
    catalog_title:"✨ Katalog", services_pro_title:"PROFI-DIENSTLEISTUNGEN", services_pro_sub:"Recht, Schönheit, Reparatur, Bildung...",
    home_client_label:"KUNDE", home_guest_label:"Gast", home_space_label:"BEREICH", home_space_sub:"Verkaufen / Liefern",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Testsimulation", home_circle_label:"KREIS", home_circle_sub:"Empfehlung",
    home_settings_label:"EINSTELLUNGEN", home_settings_sub:"Konto, Rollen, PIN", product_price_real:"ECHTER PREIS", product_commission_label:"Gebühr 2%", product_total_label:"Gesamt", out_of_stock:"Nicht vorrätig",
    reviews_word:"Bewertungen", product_order_btn:"Bestellen - SIMULATION", escrow_note:"Simuliertes Treuhandkonto - Gelder bis zur Bestätigung einbehalten", confirm_title:"Bestätigen", pay_label:"Bezahlen",
    withdrawal_title:"Abholung", withdrawal_btn:"🏪 Abholung im Laden", sending_label:"Wird gesendet...", wallet_gate_desc:"Die Wallet ist registrierten Konten vorbehalten", signup_btn:"Registrieren",
    unlock_pin_title:"🔐 Entsperren (PIN)", unlock_btn:"Entsperren", no_order_msg:"Keine Bestellung", no_booking_msg:"Keine Buchung", confirm_reception_btn:"✅ Empfang bestätigen",
    leave_review_btn:"⭐ Bewertung abgeben", support_btn:"💬 Support / Problem melden", waiting_next_step:"⏳ Warten auf den Händler/Kurier für den nächsten Schritt",
    support_no_messages:"Keine Nachrichten. Schreibe hier, wenn du eine Frage zu dieser Bestellung/Buchung hast.", support_loading:"Wird geladen...", message_placeholder:"Nachricht schreiben...",
    report_problem_btn:"⚠️ Problem melden", dispute_describe_placeholder:"Beschreibe das Problem", send_btn:"Senden", cancel_btn:"Abbrechen", client_roles_title:"Aktive Rollen",
    my_favorites_title:"❤️ Meine Favoriten", my_orders_title:"📦 Meine Bestellungen", my_bookings_title:"📅 Meine Buchungen", permuta_title_banner:"🔄 PERMUTA - TESTSIMULATION",
    circle_my_code_title:"Dein persönlicher Code", circle_invite_note:"Lade deine Freunde ein - wenn sie ihre erste bestätigte echte Bestellung oder Buchung machen, erhältst du",
    circle_share_btn:"📤 Meinen Code teilen", circle_my_circle_title:"📊 Mein Kreis", circle_invited_count:"eingeladene Person(en)", circle_active_count:"wurden aktiv (erste bestätigte Transaktion)",
    settings_account_title:"👤 Mein Konto", settings_no_phone:"Keine Nummer (Gast)", settings_edit_info_btn:"Meine Informationen bearbeiten", settings_create_account_btn:"Vollständiges Konto erstellen",
    settings_appearance_title:"🎨 Erscheinungsbild", settings_dark_mode:"Dunkler Modus", settings_notifications:"Benachrichtigungen (Simulation)", settings_about_title:"ℹ️ Über",
    settings_logout_btn:"🚪 Abmelden", settings_reset_btn:"🗑 Alle Daten zurücksetzen", services_title_banner:"🧑‍💼 Alle verfügbaren Dienstleistungen", services_empty:"Noch keine Dienstleistung veröffentlicht",
    service_reserve_btn:"Buchen - SIMULATION", booking_slot_label:"für den Termin", confirm_booking_title:"Buchung bestätigen", confirm_and_pay_btn:"Bestätigen und bezahlen", cancel_booking_btn:"Buchung stornieren",
    espaces_hint:"Ein ausgegrauter Bereich bedeutet, dass diese Rolle noch nicht aktiviert ist — aktiviere sie in den Einstellungen.", espace_boutique_title:"Geschäft (Händler)", espace_boutique_desc:"Produkte verkaufen",
    espace_livraison_title:"Lieferung", espace_bureau_title:"Profi-Büro", espace_bureau_desc:"Eine Dienstleistung verkaufen", espace_gate_desc:"Verkaufen oder Liefern erfordert ein registriertes Konto",
    review_modal_title:"⭐ Bewertung abgeben", review_comment_placeholder:"Ein Kommentar (optional)", review_submit_btn:"Meine Bewertung senden",
    activate_in_settings_btn:"In den Einstellungen aktivieren", boutique_label:"Geschäft", no_reviews_yet:"Noch keine Bewertungen", add_product_btn:"＋ Produkt hinzufügen", ad_fb_title:"📈 Facebook/Instagram-Werbung",
    ad_fb_product_text:"Tippe bei einem Produkt auf \"📤 Teilen\" und wähle dann in Facebook/Instagram \"Diesen Beitrag bewerben\", um mehr Kunden zu erreichen (Budget und Zahlung werden direkt von dir auf Facebook verwaltet).",
    price_label:"Preis", stock_label:"Lagerbestand", share_btn:"📤 Teilen", edit_btn:"✏️ Bearbeiten", incoming_orders_title:"📦 Eingegangene Bestellungen", no_orders_yet:"Noch keine Bestellung.",
    next_step_btn:"➜ Nächster Schritt", new_product_title:"＋ Neues Produkt", price_fcfa_placeholder:"Preis (FCFA)", stock_placeholder:"Lagerbestand", publish_btn:"Veröffentlichen",
    new_price_placeholder:"Neuer Preis", new_stock_placeholder:"Neuer Lagerbestand", save_btn:"Speichern", bureau_pro_label:"Profi-Büro", my_services_title:"Meine Dienstleistungen", add_service_btn:"＋ Dienstleistung hinzufügen",
    ad_fb_service_text:"Tippe bei einer Dienstleistung auf \"📤 Teilen\" und wähle dann in Facebook/Instagram \"Diesen Beitrag bewerben\", um mehr Kunden zu erreichen (Budget und Zahlung werden direkt von dir auf Facebook verwaltet).",
    tariff_label:"Tarif", available_label:"Verfügbar", unavailable_label:"Nicht verfügbar", edit_tariff_btn:"✏️ Tarif", pause_btn:"⏸ Pausieren", activate_btn:"▶️ Aktivieren",
    new_service_title:"＋ Neue Dienstleistung", service_name_placeholder:"Name der Dienstleistung", tariff_fcfa_placeholder:"Tarif (FCFA)", short_desc_placeholder:"Kurzbeschreibung",
    edit_tariff_title:"✏️ Tarif bearbeiten", new_tariff_placeholder:"Neuer Tarif", finish_btn:"Abschließen", courier_label:"Kurier", per_delivery_suffix:"Punkte pro bestätigter Lieferung",
    available_deliveries_title:"📦 Verfügbare Lieferungen", no_deliveries_available:"Derzeit keine Lieferung verfügbar.", take_delivery_btn:"Übernehmen",
    my_current_deliveries_title:"🚚 Meine laufenden Lieferungen", no_deliveries_in_progress:"Keine laufende Lieferung.", mark_delivered_btn:"✅ Als geliefert markieren",
  },
  it: {
    welcome_title:"Benvenuto su MERCA", welcome_sub:"SIMULAZIONE DI TEST - nessun SMS reale ancora inviato",
    guest_btn:"👀 Continua senza account (accesso limitato)",
    guest_note:"Senza account: puoi sfogliare il catalogo con ricerca esatta, ma senza punti di benvenuto, acquisti, accesso a PERMUTA o prenotazioni. Registrati per sbloccare tutto.",
    create_account_title:"Crea un account completo", name_placeholder:"Nome completo", phone_placeholder:"Numero di telefono", city_placeholder:"Città",
    how_use_title:"Come vuoi usare MERCA?", client_only_label:"Solo cliente", client_only_desc:"Acquistare, guadagnare punti",
    details_title:"Dettagli", receive_code_btn:"Ricevi il mio codice via SMS", sending_code:"Invio del codice... (fino a 1 min la prima volta, il server si sta riattivando)",
    code_sent_title:"Codice inviato a", code_sim_note:"⚠️ SIMULAZIONE DI TEST: nessun SMS reale ancora inviato. Il codice qui sotto è stato inserito automaticamente per il test.",
    code_placeholder:"Codice a 6 cifre", verifying:"Verifica in corso...", validate_btn:"Conferma", welcome_pts:"punti di benvenuto", edit_info_link:"← Modifica le mie informazioni",
    lang_label:"Lingua",
    home_guest_mode:"Modalità ospite", home_hello:"Ciao", home_hero_title:"Yaoundé - Prezzo reale prima di tutto", tag_simulation:"SIMULAZIONE DI TEST",
    search_placeholder_exact:"Digita il prodotto esatto...", found_product_title:"Prodotto trovato - Prezzo reale prima di tutto", tag_product:"Prodotto", tag_delivery:"Consegna",
    btn_view_product:"Vedi prodotto", btn_alternatives:"Alternative", guest_catalog_hint:"Modalità ospite: digita il nome esatto di un prodotto per trovarlo. La navigazione per categorie e le alternative sono riservate agli account registrati.",
    catalog_title:"✨ Catalogo", services_pro_title:"SERVIZI PRO", services_pro_sub:"Legale, bellezza, riparazione, istruzione...",
    home_client_label:"CLIENTE", home_guest_label:"Ospite", home_space_label:"SPAZIO", home_space_sub:"Vendere / Consegnare",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Simulazione di test", home_circle_label:"CERCHIA", home_circle_sub:"Referral",
    home_settings_label:"IMPOSTAZIONI", home_settings_sub:"Account, ruoli, PIN", product_price_real:"PREZZO REALE", product_commission_label:"Commissione 2%", product_total_label:"Totale", out_of_stock:"Esaurito",
    reviews_word:"recensioni", product_order_btn:"Ordina - SIMULAZIONE", escrow_note:"Deposito simulato - fondi bloccati fino alla conferma", confirm_title:"Conferma", pay_label:"Paga",
    withdrawal_title:"Ritiro", withdrawal_btn:"🏪 Ritiro in negozio", sending_label:"Invio in corso...", wallet_gate_desc:"Il portafoglio è riservato agli account registrati", signup_btn:"Registrati",
    unlock_pin_title:"🔐 Sblocca (PIN)", unlock_btn:"Sblocca", no_order_msg:"Nessun ordine", no_booking_msg:"Nessuna prenotazione", confirm_reception_btn:"✅ Conferma ricezione",
    leave_review_btn:"⭐ Lascia una recensione", support_btn:"💬 Assistenza / Segnala un problema", waiting_next_step:"⏳ In attesa del venditore/corriere per il prossimo passaggio",
    support_no_messages:"Nessun messaggio. Scrivi qui se hai una domanda su questo ordine/prenotazione.", support_loading:"Caricamento...", message_placeholder:"Scrivi un messaggio...",
    report_problem_btn:"⚠️ Segnala un problema", dispute_describe_placeholder:"Descrivi il problema", send_btn:"Invia", cancel_btn:"Annulla", client_roles_title:"Ruoli attivi",
    my_favorites_title:"❤️ I miei preferiti", my_orders_title:"📦 I miei ordini", my_bookings_title:"📅 Le mie prenotazioni", permuta_title_banner:"🔄 PERMUTA - SIMULAZIONE DI TEST",
    circle_my_code_title:"Il tuo codice personale", circle_invite_note:"Invita i tuoi amici - quando fanno il loro primo ordine o prenotazione reale confermata, ricevi",
    circle_share_btn:"📤 Condividi il mio codice", circle_my_circle_title:"📊 La mia Cerchia", circle_invited_count:"persona/e invitata/e", circle_active_count:"diventate attive (prima transazione confermata)",
    settings_account_title:"👤 Il mio account", settings_no_phone:"Nessun numero (ospite)", settings_edit_info_btn:"Modifica le mie informazioni", settings_create_account_btn:"Crea un account completo",
    settings_appearance_title:"🎨 Aspetto", settings_dark_mode:"Modalità scura", settings_notifications:"Notifiche (simulazione)", settings_about_title:"ℹ️ Informazioni",
    settings_logout_btn:"🚪 Disconnetti", settings_reset_btn:"🗑 Reimposta tutti i dati", services_title_banner:"🧑‍💼 Tutti i servizi disponibili", services_empty:"Nessun servizio ancora pubblicato",
    service_reserve_btn:"Prenota - SIMULAZIONE", booking_slot_label:"per la fascia oraria", confirm_booking_title:"Conferma la prenotazione", confirm_and_pay_btn:"Conferma e paga", cancel_booking_btn:"Annulla la prenotazione",
    espaces_hint:"Uno spazio in grigio significa che questo ruolo non è ancora attivato — attivalo dalle Impostazioni.", espace_boutique_title:"Negozio (Commerciante)", espace_boutique_desc:"Vendere prodotti",
    espace_livraison_title:"Consegna", espace_bureau_title:"Ufficio Pro", espace_bureau_desc:"Vendere un servizio", espace_gate_desc:"Vendere o consegnare richiede un account registrato",
    review_modal_title:"⭐ Lascia una recensione", review_comment_placeholder:"Un commento (facoltativo)", review_submit_btn:"Invia la mia recensione",
    activate_in_settings_btn:"Attiva nelle Impostazioni", boutique_label:"Negozio", no_reviews_yet:"Ancora nessuna recensione", add_product_btn:"＋ Aggiungi prodotto", ad_fb_title:"📈 Pubblicità Facebook/Instagram",
    ad_fb_product_text:"Tocca \"📤 Condividi\" su un prodotto, poi su Facebook/Instagram scegli \"Metti in evidenza questo post\" per raggiungere più clienti (budget e pagamento gestiti direttamente da te su Facebook).",
    price_label:"Prezzo", stock_label:"Scorte", share_btn:"📤 Condividi", edit_btn:"✏️ Modifica", incoming_orders_title:"📦 Ordini ricevuti", no_orders_yet:"Nessun ordine per il momento.",
    next_step_btn:"➜ Passaggio successivo", new_product_title:"＋ Nuovo prodotto", price_fcfa_placeholder:"Prezzo (FCFA)", stock_placeholder:"Scorte", publish_btn:"Pubblica",
    new_price_placeholder:"Nuovo prezzo", new_stock_placeholder:"Nuove scorte", save_btn:"Salva", bureau_pro_label:"Ufficio Pro", my_services_title:"I miei servizi", add_service_btn:"＋ Aggiungi un servizio",
    ad_fb_service_text:"Tocca \"📤 Condividi\" su un servizio, poi su Facebook/Instagram scegli \"Metti in evidenza questo post\" per raggiungere più clienti (budget e pagamento gestiti direttamente da te su Facebook).",
    tariff_label:"Tariffa", available_label:"Disponibile", unavailable_label:"Non disponibile", edit_tariff_btn:"✏️ Tariffa", pause_btn:"⏸ Pausa", activate_btn:"▶️ Attiva",
    new_service_title:"＋ Nuovo servizio", service_name_placeholder:"Nome del servizio", tariff_fcfa_placeholder:"Tariffa (FCFA)", short_desc_placeholder:"Breve descrizione",
    edit_tariff_title:"✏️ Modifica tariffa", new_tariff_placeholder:"Nuova tariffa", finish_btn:"Termina", courier_label:"Corriere", per_delivery_suffix:"pt per consegna confermata",
    available_deliveries_title:"📦 Consegne disponibili", no_deliveries_available:"Nessuna consegna disponibile al momento.", take_delivery_btn:"Prendi",
    my_current_deliveries_title:"🚚 Le mie consegne in corso", no_deliveries_in_progress:"Nessuna consegna in corso.", mark_delivered_btn:"✅ Segna come consegnato",
  },
  tr: {
    welcome_title:"MERCA'ya hoş geldiniz", welcome_sub:"TEST SİMÜLASYONU - henüz gerçek SMS gönderilmedi",
    guest_btn:"👀 Hesapsız devam et (sınırlı erişim)",
    guest_note:"Hesap olmadan: kataloğu tam arama ile görebilirsin, ancak hoş geldin puanı, satın alma, PERMUTA veya rezervasyon erişimi yoktur. Her şeyin kilidini açmak için kaydol.",
    create_account_title:"Tam hesap oluştur", name_placeholder:"Ad soyad", phone_placeholder:"Telefon numarası", city_placeholder:"Şehir",
    how_use_title:"MERCA'yı nasıl kullanmak istersin?", client_only_label:"Sadece müşteri", client_only_desc:"Satın al, puan kazan",
    details_title:"Ayrıntılar", receive_code_btn:"Kodumu SMS ile al", sending_code:"Kod gönderiliyor... (ilk seferde 1 dakikaya kadar sürebilir, sunucu uyanıyor)",
    code_sent_title:"Kod gönderildi:", code_sim_note:"⚠️ TEST SİMÜLASYONU: henüz gerçek SMS gönderilmedi. Aşağıdaki kod test için otomatik dolduruldu.",
    code_placeholder:"6 haneli kod", verifying:"Doğrulanıyor...", validate_btn:"Onayla", welcome_pts:"hoş geldin puanı", edit_info_link:"← Bilgilerimi düzenle",
    lang_label:"Dil",
    home_guest_mode:"Misafir modu", home_hello:"Merhaba", home_hero_title:"Yaoundé - Önce gerçek fiyat", tag_simulation:"TEST SİMÜLASYONU",
    search_placeholder_exact:"Tam ürün adını yaz...", found_product_title:"Ürün bulundu - Önce gerçek fiyat", tag_product:"Ürün", tag_delivery:"Teslimat",
    btn_view_product:"Ürünü gör", btn_alternatives:"Alternatifler", guest_catalog_hint:"Misafir modu: bulmak için bir ürünün tam adını yaz. Kategorilere göre gezinme ve alternatifler yalnızca kayıtlı hesaplar için geçerlidir.",
    catalog_title:"✨ Katalog", services_pro_title:"PROFESYONEL HİZMETLER", services_pro_sub:"Hukuk, güzellik, tamir, eğitim...",
    home_client_label:"MÜŞTERİ", home_guest_label:"Misafir", home_space_label:"ALAN", home_space_sub:"Sat / Teslim et",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Test simülasyonu", home_circle_label:"ÇEMBER", home_circle_sub:"Tavsiye",
    home_settings_label:"AYARLAR", home_settings_sub:"Hesap, roller, PIN", product_price_real:"GERÇEK FİYAT", product_commission_label:"Komisyon %2", product_total_label:"Toplam", out_of_stock:"Stokta yok",
    reviews_word:"yorum", product_order_btn:"Sipariş ver - SİMÜLASYON", escrow_note:"Simüle edilmiş emanet - onaya kadar fonlar bloke edilir", confirm_title:"Onayla", pay_label:"Öde",
    withdrawal_title:"Teslim alma", withdrawal_btn:"🏪 Mağazadan teslim alma", sending_label:"Gönderiliyor...", wallet_gate_desc:"Cüzdan yalnızca kayıtlı hesaplar içindir", signup_btn:"Kaydol",
    unlock_pin_title:"🔐 Kilidi aç (PIN)", unlock_btn:"Kilidi aç", no_order_msg:"Sipariş yok", no_booking_msg:"Rezervasyon yok", confirm_reception_btn:"✅ Teslimatı onayla",
    leave_review_btn:"⭐ Yorum bırak", support_btn:"💬 Destek / Sorun bildir", waiting_next_step:"⏳ Bir sonraki adım için satıcı/kurye bekleniyor",
    support_no_messages:"Mesaj yok. Bu sipariş/rezervasyon hakkında bir sorunuz varsa buraya yazın.", support_loading:"Yükleniyor...", message_placeholder:"Bir mesaj yaz...",
    report_problem_btn:"⚠️ Sorun bildir", dispute_describe_placeholder:"Sorunu açıkla", send_btn:"Gönder", cancel_btn:"İptal", client_roles_title:"Aktif roller",
    my_favorites_title:"❤️ Favorilerim", my_orders_title:"📦 Siparişlerim", my_bookings_title:"📅 Rezervasyonlarım", permuta_title_banner:"🔄 PERMUTA - TEST SİMÜLASYONU",
    circle_my_code_title:"Kişisel kodun", circle_invite_note:"Arkadaşlarını davet et - ilk onaylı gerçek siparişlerini veya rezervasyonlarını yaptıklarında şunu alırsın:",
    circle_share_btn:"📤 Kodumu paylaş", circle_my_circle_title:"📊 Çemberim", circle_invited_count:"davet edilen kişi", circle_active_count:"aktif hale geldi (ilk onaylanmış işlem)",
    settings_account_title:"👤 Hesabım", settings_no_phone:"Numara yok (misafir)", settings_edit_info_btn:"Bilgilerimi düzenle", settings_create_account_btn:"Tam hesap oluştur",
    settings_appearance_title:"🎨 Görünüm", settings_dark_mode:"Karanlık mod", settings_notifications:"Bildirimler (simülasyon)", settings_about_title:"ℹ️ Hakkında",
    settings_logout_btn:"🚪 Çıkış yap", settings_reset_btn:"🗑 Tüm verileri sıfırla", services_title_banner:"🧑‍💼 Mevcut tüm hizmetler", services_empty:"Henüz yayınlanmış hizmet yok",
    service_reserve_btn:"Rezervasyon yap - SİMÜLASYON", booking_slot_label:"randevu için", confirm_booking_title:"Rezervasyonu onayla", confirm_and_pay_btn:"Onayla ve öde", cancel_booking_btn:"Rezervasyonu iptal et",
    espaces_hint:"Gri bir alan, bu rolün henüz etkinleştirilmediği anlamına gelir — Ayarlar'dan etkinleştir.", espace_boutique_title:"Mağaza (Satıcı)", espace_boutique_desc:"Ürün satmak",
    espace_livraison_title:"Teslimat", espace_bureau_title:"Profesyonel Ofis", espace_bureau_desc:"Hizmet satmak", espace_gate_desc:"Satış veya teslimat için kayıtlı bir hesap gerekir",
    review_modal_title:"⭐ Yorum bırak", review_comment_placeholder:"Bir yorum (isteğe bağlı)", review_submit_btn:"Yorumumu gönder",
    activate_in_settings_btn:"Ayarlardan etkinleştir", boutique_label:"Mağaza", no_reviews_yet:"Henüz yorum yok", add_product_btn:"＋ Ürün ekle", ad_fb_title:"📈 Facebook/Instagram Reklamları",
    ad_fb_product_text:"Bir üründe \"📤 Paylaş\"a dokun, ardından Facebook/Instagram'da daha fazla müşteriye ulaşmak için \"Bu gönderiyi öne çıkar\"ı seç (bütçe ve ödeme doğrudan senin tarafından Facebook üzerinden yönetilir).",
    price_label:"Fiyat", stock_label:"Stok", share_btn:"📤 Paylaş", edit_btn:"✏️ Düzenle", incoming_orders_title:"📦 Gelen siparişler", no_orders_yet:"Şu an için sipariş yok.",
    next_step_btn:"➜ Sonraki adım", new_product_title:"＋ Yeni ürün", price_fcfa_placeholder:"Fiyat (FCFA)", stock_placeholder:"Stok", publish_btn:"Yayınla",
    new_price_placeholder:"Yeni fiyat", new_stock_placeholder:"Yeni stok", save_btn:"Kaydet", bureau_pro_label:"Profesyonel Ofis", my_services_title:"Hizmetlerim", add_service_btn:"＋ Hizmet ekle",
    ad_fb_service_text:"Bir hizmette \"📤 Paylaş\"a dokun, ardından Facebook/Instagram'da daha fazla müşteriye ulaşmak için \"Bu gönderiyi öne çıkar\"ı seç (bütçe ve ödeme doğrudan senin tarafından Facebook üzerinden yönetilir).",
    tariff_label:"Ücret", available_label:"Müsait", unavailable_label:"Müsait değil", edit_tariff_btn:"✏️ Ücret", pause_btn:"⏸ Duraklat", activate_btn:"▶️ Etkinleştir",
    new_service_title:"＋ Yeni hizmet", service_name_placeholder:"Hizmet adı", tariff_fcfa_placeholder:"Ücret (FCFA)", short_desc_placeholder:"Kısa açıklama",
    edit_tariff_title:"✏️ Ücreti düzenle", new_tariff_placeholder:"Yeni ücret", finish_btn:"Tamamla", courier_label:"Kurye", per_delivery_suffix:"onaylanan teslimat başına puan",
    available_deliveries_title:"📦 Müsait teslimatlar", no_deliveries_available:"Şu an müsait teslimat yok.", take_delivery_btn:"Al",
    my_current_deliveries_title:"🚚 Devam eden teslimatlarım", no_deliveries_in_progress:"Devam eden teslimat yok.", mark_delivered_btn:"✅ Teslim edildi olarak işaretle",
  },
  ru: {
    welcome_title:"Добро пожаловать в MERCA", welcome_sub:"ТЕСТОВАЯ СИМУЛЯЦИЯ - настоящее SMS пока не отправлено",
    guest_btn:"👀 Продолжить без аккаунта (ограниченный доступ)",
    guest_note:"Без аккаунта: вы можете просматривать каталог с точным поиском, но без приветственных баллов, покупок, доступа к PERMUTA или бронированиям. Зарегистрируйтесь, чтобы открыть всё.",
    create_account_title:"Создать полный аккаунт", name_placeholder:"Полное имя", phone_placeholder:"Номер телефона", city_placeholder:"Город",
    how_use_title:"Как вы хотите использовать MERCA?", client_only_label:"Только клиент", client_only_desc:"Покупать, зарабатывать баллы",
    details_title:"Детали", receive_code_btn:"Получить код по SMS", sending_code:"Отправка кода... (до 1 мин в первый раз, сервер просыпается)",
    code_sent_title:"Код отправлен на", code_sim_note:"⚠️ ТЕСТОВАЯ СИМУЛЯЦИЯ: настоящее SMS пока не отправлено. Код ниже заполнен автоматически для теста.",
    code_placeholder:"6-значный код", verifying:"Проверка...", validate_btn:"Подтвердить", welcome_pts:"приветственных баллов", edit_info_link:"← Изменить мои данные",
    lang_label:"Язык",
    home_guest_mode:"Гостевой режим", home_hello:"Привет", home_hero_title:"Яунде - Сначала реальная цена", tag_simulation:"ТЕСТОВАЯ СИМУЛЯЦИЯ",
    search_placeholder_exact:"Введите точное название товара...", found_product_title:"Товар найден - Сначала реальная цена", tag_product:"Товар", tag_delivery:"Доставка",
    btn_view_product:"Посмотреть товар", btn_alternatives:"Альтернативы", guest_catalog_hint:"Гостевой режим: введите точное название товара, чтобы найти его. Просмотр по категориям и альтернативы доступны только зарегистрированным аккаунтам.",
    catalog_title:"✨ Каталог", services_pro_title:"ПРОФЕССИОНАЛЬНЫЕ УСЛУГИ", services_pro_sub:"Юридические, красота, ремонт, образование...",
    home_client_label:"КЛИЕНТ", home_guest_label:"Гость", home_space_label:"ПРОСТРАНСТВО", home_space_sub:"Продавать / Доставлять",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Тестовая симуляция", home_circle_label:"КРУГ", home_circle_sub:"Реферальная программа",
    home_settings_label:"НАСТРОЙКИ", home_settings_sub:"Аккаунт, роли, PIN", product_price_real:"РЕАЛЬНАЯ ЦЕНА", product_commission_label:"Комиссия 2%", product_total_label:"Итого", out_of_stock:"Нет в наличии",
    reviews_word:"отзывов", product_order_btn:"Заказать - СИМУЛЯЦИЯ", escrow_note:"Симулированное эскроу - средства заблокированы до подтверждения", confirm_title:"Подтвердить", pay_label:"Оплатить",
    withdrawal_title:"Самовывоз", withdrawal_btn:"🏪 Самовывоз из магазина", sending_label:"Отправка...", wallet_gate_desc:"Кошелёк доступен только зарегистрированным аккаунтам", signup_btn:"Зарегистрироваться",
    unlock_pin_title:"🔐 Разблокировать (PIN)", unlock_btn:"Разблокировать", no_order_msg:"Нет заказа", no_booking_msg:"Нет бронирования", confirm_reception_btn:"✅ Подтвердить получение",
    leave_review_btn:"⭐ Оставить отзыв", support_btn:"💬 Поддержка / Сообщить о проблеме", waiting_next_step:"⏳ Ожидание продавца/курьера для следующего шага",
    support_no_messages:"Нет сообщений. Напишите здесь, если у вас есть вопрос по этому заказу/бронированию.", support_loading:"Загрузка...", message_placeholder:"Написать сообщение...",
    report_problem_btn:"⚠️ Сообщить о проблеме", dispute_describe_placeholder:"Опишите проблему", send_btn:"Отправить", cancel_btn:"Отмена", client_roles_title:"Активные роли",
    my_favorites_title:"❤️ Мои избранные", my_orders_title:"📦 Мои заказы", my_bookings_title:"📅 Мои бронирования", permuta_title_banner:"🔄 PERMUTA - ТЕСТОВАЯ СИМУЛЯЦИЯ",
    circle_my_code_title:"Ваш персональный код", circle_invite_note:"Пригласите друзей - когда они сделают свой первый подтверждённый реальный заказ или бронирование, вы получите",
    circle_share_btn:"📤 Поделиться моим кодом", circle_my_circle_title:"📊 Мой Круг", circle_invited_count:"приглашённый(ые) человек(и)", circle_active_count:"стали активными (первая подтверждённая транзакция)",
    settings_account_title:"👤 Мой аккаунт", settings_no_phone:"Нет номера (гость)", settings_edit_info_btn:"Изменить мои данные", settings_create_account_btn:"Создать полный аккаунт",
    settings_appearance_title:"🎨 Внешний вид", settings_dark_mode:"Тёмный режим", settings_notifications:"Уведомления (симуляция)", settings_about_title:"ℹ️ О приложении",
    settings_logout_btn:"🚪 Выйти", settings_reset_btn:"🗑 Сбросить все данные", services_title_banner:"🧑‍💼 Все доступные услуги", services_empty:"Пока нет опубликованных услуг",
    service_reserve_btn:"Забронировать - СИМУЛЯЦИЯ", booking_slot_label:"на слот", confirm_booking_title:"Подтвердить бронирование", confirm_and_pay_btn:"Подтвердить и оплатить", cancel_booking_btn:"Отменить бронирование",
    espaces_hint:"Серая область означает, что эта роль ещё не активирована — активируйте её в Настройках.", espace_boutique_title:"Магазин (Продавец)", espace_boutique_desc:"Продавать товары",
    espace_livraison_title:"Доставка", espace_bureau_title:"Профессиональный офис", espace_bureau_desc:"Продавать услугу", espace_gate_desc:"Для продажи или доставки требуется зарегистрированный аккаунт",
    review_modal_title:"⭐ Оставить отзыв", review_comment_placeholder:"Комментарий (необязательно)", review_submit_btn:"Отправить мой отзыв",
    activate_in_settings_btn:"Активировать в Настройках", boutique_label:"Магазин", no_reviews_yet:"Пока нет отзывов", add_product_btn:"＋ Добавить товар", ad_fb_title:"📈 Реклама в Facebook/Instagram",
    ad_fb_product_text:"Нажмите \"📤 Поделиться\" на товаре, затем в Facebook/Instagram выберите \"Продвигать эту публикацию\", чтобы привлечь больше клиентов (бюджет и оплата управляются напрямую вами в Facebook).",
    price_label:"Цена", stock_label:"Запас", share_btn:"📤 Поделиться", edit_btn:"✏️ Изменить", incoming_orders_title:"📦 Полученные заказы", no_orders_yet:"Пока нет заказов.",
    next_step_btn:"➜ Следующий этап", new_product_title:"＋ Новый товар", price_fcfa_placeholder:"Цена (FCFA)", stock_placeholder:"Запас", publish_btn:"Опубликовать",
    new_price_placeholder:"Новая цена", new_stock_placeholder:"Новый запас", save_btn:"Сохранить", bureau_pro_label:"Профессиональный офис", my_services_title:"Мои услуги", add_service_btn:"＋ Добавить услугу",
    ad_fb_service_text:"Нажмите \"📤 Поделиться\" на услуге, затем в Facebook/Instagram выберите \"Продвигать эту публикацию\", чтобы привлечь больше клиентов (бюджет и оплата управляются напрямую вами в Facebook).",
    tariff_label:"Тариф", available_label:"Доступно", unavailable_label:"Недоступно", edit_tariff_btn:"✏️ Тариф", pause_btn:"⏸ Пауза", activate_btn:"▶️ Включить",
    new_service_title:"＋ Новая услуга", service_name_placeholder:"Название услуги", tariff_fcfa_placeholder:"Тариф (FCFA)", short_desc_placeholder:"Короткое описание",
    edit_tariff_title:"✏️ Изменить тариф", new_tariff_placeholder:"Новый тариф", finish_btn:"Завершить", courier_label:"Курьер", per_delivery_suffix:"баллов за подтверждённую доставку",
    available_deliveries_title:"📦 Доступные доставки", no_deliveries_available:"Сейчас нет доступных доставок.", take_delivery_btn:"Взять",
    my_current_deliveries_title:"🚚 Мои текущие доставки", no_deliveries_in_progress:"Нет текущих доставок.", mark_delivered_btn:"✅ Отметить доставленным",
  },
  hi: {
    welcome_title:"MERCA में आपका स्वागत है", welcome_sub:"परीक्षण सिमुलेशन - अभी तक कोई वास्तविक SMS नहीं भेजा गया",
    guest_btn:"👀 बिना खाते के जारी रखें (सीमित पहुंच)",
    guest_note:"बिना खाते के: आप सटीक खोज के साथ कैटलॉग देख सकते हैं, लेकिन स्वागत अंक, खरीदारी, PERMUTA या बुकिंग तक पहुंच नहीं मिलेगी। सब कुछ अनलॉक करने के लिए साइन अप करें।",
    create_account_title:"पूरा खाता बनाएं", name_placeholder:"पूरा नाम", phone_placeholder:"फ़ोन नंबर", city_placeholder:"शहर",
    how_use_title:"आप MERCA का उपयोग कैसे करना चाहते हैं?", client_only_label:"केवल ग्राहक", client_only_desc:"खरीदें, अंक कमाएं",
    details_title:"विवरण", receive_code_btn:"SMS से अपना कोड प्राप्त करें", sending_code:"कोड भेजा जा रहा है... (पहली बार 1 मिनट तक लग सकता है, सर्वर जाग रहा है)",
    code_sent_title:"कोड भेजा गया", code_sim_note:"⚠️ परीक्षण सिमुलेशन: अभी तक कोई वास्तविक SMS नहीं भेजा गया। नीचे दिया गया कोड परीक्षण के लिए स्वतः भर दिया गया है।",
    code_placeholder:"6 अंकों का कोड", verifying:"सत्यापन हो रहा है...", validate_btn:"पुष्टि करें", welcome_pts:"स्वागत अंक", edit_info_link:"← मेरी जानकारी संपादित करें",
    lang_label:"भाषा",
    home_guest_mode:"अतिथि मोड", home_hello:"नमस्ते", home_hero_title:"याउंडे - पहले असली कीमत", tag_simulation:"परीक्षण सिमुलेशन",
    search_placeholder_exact:"सटीक उत्पाद टाइप करें...", found_product_title:"उत्पाद मिला - पहले असली कीमत", tag_product:"उत्पाद", tag_delivery:"डिलीवरी",
    btn_view_product:"उत्पाद देखें", btn_alternatives:"विकल्प", guest_catalog_hint:"अतिथि मोड: किसी उत्पाद को खोजने के लिए उसका सटीक नाम टाइप करें। श्रेणी ब्राउज़िंग और विकल्प केवल पंजीकृत खातों के लिए आरक्षित हैं।",
    catalog_title:"✨ कैटलॉग", services_pro_title:"पेशेवर सेवाएं", services_pro_sub:"कानूनी, सौंदर्य, मरम्मत, शिक्षा...",
    home_client_label:"ग्राहक", home_guest_label:"अतिथि", home_space_label:"स्थान", home_space_sub:"बेचें / डिलीवर करें",
    home_permuta_label:"PERMUTA", home_permuta_sub:"परीक्षण सिमुलेशन", home_circle_label:"सर्कल", home_circle_sub:"रेफरल",
    home_settings_label:"सेटिंग्स", home_settings_sub:"खाता, भूमिकाएं, पिन", product_price_real:"असली कीमत", product_commission_label:"शुल्क 2%", product_total_label:"कुल", out_of_stock:"स्टॉक समाप्त",
    reviews_word:"समीक्षाएं", product_order_btn:"ऑर्डर करें - सिमुलेशन", escrow_note:"सिम्युलेटेड एस्क्रो - पुष्टि होने तक धनराशि रोकी गई", confirm_title:"पुष्टि करें", pay_label:"भुगतान करें",
    withdrawal_title:"पिकअप", withdrawal_btn:"🏪 दुकान से पिकअप", sending_label:"भेजा जा रहा है...", wallet_gate_desc:"वॉलेट केवल पंजीकृत खातों के लिए आरक्षित है", signup_btn:"साइन अप करें",
    unlock_pin_title:"🔐 अनलॉक करें (पिन)", unlock_btn:"अनलॉक करें", no_order_msg:"कोई ऑर्डर नहीं", no_booking_msg:"कोई बुकिंग नहीं", confirm_reception_btn:"✅ प्राप्ति की पुष्टि करें",
    leave_review_btn:"⭐ समीक्षा छोड़ें", support_btn:"💬 सहायता / समस्या की रिपोर्ट करें", waiting_next_step:"⏳ अगले चरण के लिए विक्रेता/डिलीवरी वाले का इंतजार",
    support_no_messages:"कोई संदेश नहीं। यदि इस ऑर्डर/बुकिंग के बारे में कोई प्रश्न है तो यहां लिखें।", support_loading:"लोड हो रहा है...", message_placeholder:"संदेश लिखें...",
    report_problem_btn:"⚠️ समस्या की रिपोर्ट करें", dispute_describe_placeholder:"समस्या का वर्णन करें", send_btn:"भेजें", cancel_btn:"रद्द करें", client_roles_title:"सक्रिय भूमिकाएं",
    my_favorites_title:"❤️ मेरे पसंदीदा", my_orders_title:"📦 मेरे ऑर्डर", my_bookings_title:"📅 मेरी बुकिंग", permuta_title_banner:"🔄 PERMUTA - परीक्षण सिमुलेशन",
    circle_my_code_title:"आपका व्यक्तिगत कोड", circle_invite_note:"अपने दोस्तों को आमंत्रित करें - जब वे अपना पहला पुष्ट वास्तविक ऑर्डर या बुकिंग करते हैं, तो आपको मिलता है",
    circle_share_btn:"📤 मेरा कोड साझा करें", circle_my_circle_title:"📊 मेरा सर्कल", circle_invited_count:"व्यक्ति आमंत्रित", circle_active_count:"सक्रिय हो गए (पहला पुष्ट लेनदेन)",
    settings_account_title:"👤 मेरा खाता", settings_no_phone:"कोई नंबर नहीं (अतिथि)", settings_edit_info_btn:"मेरी जानकारी संपादित करें", settings_create_account_btn:"पूरा खाता बनाएं",
    settings_appearance_title:"🎨 रूप-रंग", settings_dark_mode:"डार्क मोड", settings_notifications:"सूचनाएं (सिमुलेशन)", settings_about_title:"ℹ️ के बारे में",
    settings_logout_btn:"🚪 लॉग आउट करें", settings_reset_btn:"🗑 सभी डेटा रीसेट करें", services_title_banner:"🧑‍💼 सभी उपलब्ध सेवाएं", services_empty:"अभी तक कोई सेवा प्रकाशित नहीं हुई",
    service_reserve_btn:"बुक करें - सिमुलेशन", booking_slot_label:"स्लॉट के लिए", confirm_booking_title:"बुकिंग की पुष्टि करें", confirm_and_pay_btn:"पुष्टि करें और भुगतान करें", cancel_booking_btn:"बुकिंग रद्द करें",
    espaces_hint:"धूसर स्थान का अर्थ है कि यह भूमिका अभी सक्रिय नहीं है — इसे सेटिंग्स से सक्रिय करें।", espace_boutique_title:"दुकान (व्यापारी)", espace_boutique_desc:"उत्पाद बेचें",
    espace_livraison_title:"डिलीवरी", espace_bureau_title:"पेशेवर कार्यालय", espace_bureau_desc:"एक सेवा बेचें", espace_gate_desc:"बेचने या डिलीवर करने के लिए पंजीकृत खाता आवश्यक है",
    review_modal_title:"⭐ समीक्षा छोड़ें", review_comment_placeholder:"एक टिप्पणी (वैकल्पिक)", review_submit_btn:"मेरी समीक्षा भेजें",
    activate_in_settings_btn:"सेटिंग्स में सक्रिय करें", boutique_label:"दुकान", no_reviews_yet:"अभी तक कोई समीक्षा नहीं", add_product_btn:"＋ उत्पाद जोड़ें", ad_fb_title:"📈 Facebook/Instagram विज्ञापन",
    ad_fb_product_text:"किसी उत्पाद पर \"📤 साझा करें\" दबाएं, फिर Facebook/Instagram में अधिक ग्राहकों तक पहुंचने के लिए \"इस पोस्ट को बूस्ट करें\" चुनें (बजट और भुगतान सीधे आपके द्वारा Facebook पर प्रबंधित किए जाते हैं)।",
    price_label:"कीमत", stock_label:"स्टॉक", share_btn:"📤 साझा करें", edit_btn:"✏️ संपादित करें", incoming_orders_title:"📦 प्राप्त ऑर्डर", no_orders_yet:"अभी तक कोई ऑर्डर नहीं।",
    next_step_btn:"➜ अगला चरण", new_product_title:"＋ नया उत्पाद", price_fcfa_placeholder:"कीमत (FCFA)", stock_placeholder:"स्टॉक", publish_btn:"प्रकाशित करें",
    new_price_placeholder:"नई कीमत", new_stock_placeholder:"नया स्टॉक", save_btn:"सहेजें", bureau_pro_label:"पेशेवर कार्यालय", my_services_title:"मेरी सेवाएं", add_service_btn:"＋ सेवा जोड़ें",
    ad_fb_service_text:"किसी सेवा पर \"📤 साझा करें\" दबाएं, फिर Facebook/Instagram में अधिक ग्राहकों तक पहुंचने के लिए \"इस पोस्ट को बूस्ट करें\" चुनें (बजट और भुगतान सीधे आपके द्वारा Facebook पर प्रबंधित किए जाते हैं)।",
    tariff_label:"शुल्क", available_label:"उपलब्ध", unavailable_label:"अनुपलब्ध", edit_tariff_btn:"✏️ शुल्क", pause_btn:"⏸ रोकें", activate_btn:"▶️ सक्रिय करें",
    new_service_title:"＋ नई सेवा", service_name_placeholder:"सेवा का नाम", tariff_fcfa_placeholder:"शुल्क (FCFA)", short_desc_placeholder:"संक्षिप्त विवरण",
    edit_tariff_title:"✏️ शुल्क संपादित करें", new_tariff_placeholder:"नया शुल्क", finish_btn:"समाप्त करें", courier_label:"डिलीवरी वाला", per_delivery_suffix:"अंक प्रति पुष्ट डिलीवरी",
    available_deliveries_title:"📦 उपलब्ध डिलीवरी", no_deliveries_available:"अभी कोई डिलीवरी उपलब्ध नहीं है।", take_delivery_btn:"लें",
    my_current_deliveries_title:"🚚 मेरी चल रही डिलीवरी", no_deliveries_in_progress:"कोई डिलीवरी चल नहीं रही है।", mark_delivered_btn:"✅ डिलीवर के रूप में चिह्नित करें",
  },
  ja: {
    welcome_title:"MERCAへようこそ", welcome_sub:"テストシミュレーション - 実際のSMSはまだ送信されていません",
    guest_btn:"👀 アカウントなしで続ける（アクセス制限あり）",
    guest_note:"アカウントなしの場合：完全一致検索でカタログを閲覧できますが、ウェルカムポイント、購入、PERMUTAや予約へのアクセスはできません。すべてを解除するには登録してください。",
    create_account_title:"完全なアカウントを作成", name_placeholder:"氏名", phone_placeholder:"電話番号", city_placeholder:"都市",
    how_use_title:"MERCAをどのように使いたいですか？", client_only_label:"顧客のみ", client_only_desc:"購入してポイントを獲得",
    details_title:"詳細", receive_code_btn:"SMSでコードを受け取る", sending_code:"コードを送信中...（初回は最大1分、サーバーが起動中です）",
    code_sent_title:"コード送信先", code_sim_note:"⚠️ テストシミュレーション：実際のSMSはまだ送信されていません。以下のコードはテスト用に自動入力されています。",
    code_placeholder:"6桁のコード", verifying:"確認中...", validate_btn:"確定", welcome_pts:"ウェルカムポイント", edit_info_link:"← 情報を編集",
    lang_label:"言語",
    home_guest_mode:"ゲストモード", home_hello:"こんにちは", home_hero_title:"ヤウンデ - 実価格優先", tag_simulation:"テストシミュレーション",
    search_placeholder_exact:"正確な商品名を入力...", found_product_title:"商品が見つかりました - 実価格優先", tag_product:"商品", tag_delivery:"配送",
    btn_view_product:"商品を見る", btn_alternatives:"代替案", guest_catalog_hint:"ゲストモード：商品を見つけるには正確な名前を入力してください。カテゴリ閲覧と代替案は登録済みアカウント限定です。",
    catalog_title:"✨ カタログ", services_pro_title:"プロサービス", services_pro_sub:"法律、美容、修理、教育...",
    home_client_label:"顧客", home_guest_label:"ゲスト", home_space_label:"スペース", home_space_sub:"販売 / 配達",
    home_permuta_label:"PERMUTA", home_permuta_sub:"テストシミュレーション", home_circle_label:"サークル", home_circle_sub:"紹介",
    home_settings_label:"設定", home_settings_sub:"アカウント、役割、PIN", product_price_real:"実価格", product_commission_label:"手数料2%", product_total_label:"合計", out_of_stock:"在庫切れ",
    reviews_word:"レビュー", product_order_btn:"注文する - シミュレーション", escrow_note:"模擬エスクロー - 確認されるまで資金は保留されます", confirm_title:"確認", pay_label:"支払う",
    withdrawal_title:"引き取り", withdrawal_btn:"🏪 店舗で引き取り", sending_label:"送信中...", wallet_gate_desc:"ウォレットは登録済みアカウント限定です", signup_btn:"登録する",
    unlock_pin_title:"🔐 ロック解除（PIN）", unlock_btn:"ロック解除", no_order_msg:"注文はありません", no_booking_msg:"予約はありません", confirm_reception_btn:"✅ 受け取りを確認",
    leave_review_btn:"⭐ レビューを残す", support_btn:"💬 サポート / 問題を報告", waiting_next_step:"⏳ 次のステップのため販売者/配達員を待っています",
    support_no_messages:"メッセージはありません。この注文/予約について質問があればここに書いてください。", support_loading:"読み込み中...", message_placeholder:"メッセージを書く...",
    report_problem_btn:"⚠️ 問題を報告", dispute_describe_placeholder:"問題を説明してください", send_btn:"送信", cancel_btn:"キャンセル", client_roles_title:"有効な役割",
    my_favorites_title:"❤️ お気に入り", my_orders_title:"📦 注文履歴", my_bookings_title:"📅 予約一覧", permuta_title_banner:"🔄 PERMUTA - テストシミュレーション",
    circle_my_code_title:"あなたの個人コード", circle_invite_note:"友達を招待しよう - 彼らが最初の確認済みの注文や予約を行うと、あなたは次を受け取ります：",
    circle_share_btn:"📤 自分のコードを共有", circle_my_circle_title:"📊 マイサークル", circle_invited_count:"人招待済み", circle_active_count:"アクティブになりました（最初の確認済み取引）",
    settings_account_title:"👤 マイアカウント", settings_no_phone:"番号なし（ゲスト）", settings_edit_info_btn:"情報を編集", settings_create_account_btn:"完全なアカウントを作成",
    settings_appearance_title:"🎨 外観", settings_dark_mode:"ダークモード", settings_notifications:"通知（シミュレーション）", settings_about_title:"ℹ️ アプリについて",
    settings_logout_btn:"🚪 ログアウト", settings_reset_btn:"🗑 すべてのデータをリセット", services_title_banner:"🧑‍💼 利用可能なすべてのサービス", services_empty:"まだ公開されているサービスはありません",
    service_reserve_btn:"予約する - シミュレーション", booking_slot_label:"枠について", confirm_booking_title:"予約を確認", confirm_and_pay_btn:"確認して支払う", cancel_booking_btn:"予約をキャンセル",
    espaces_hint:"グレー表示のスペースは、この役割がまだ有効になっていないことを意味します — 設定から有効にしてください。", espace_boutique_title:"店舗（販売者）", espace_boutique_desc:"商品を販売する",
    espace_livraison_title:"配達", espace_bureau_title:"プロオフィス", espace_bureau_desc:"サービスを販売する", espace_gate_desc:"販売や配達には登録済みアカウントが必要です",
    review_modal_title:"⭐ レビューを残す", review_comment_placeholder:"コメント（任意）", review_submit_btn:"レビューを送信",
    activate_in_settings_btn:"設定で有効にする", boutique_label:"店舗", no_reviews_yet:"まだレビューはありません", add_product_btn:"＋ 商品を追加", ad_fb_title:"📈 Facebook/Instagram広告",
    ad_fb_product_text:"商品の\"📤 共有\"をタップし、Facebook/Instagramで\"この投稿を宣伝\"を選ぶとより多くの顧客にリーチできます（予算と支払いはFacebook上でご自身が直接管理します）。",
    price_label:"価格", stock_label:"在庫", share_btn:"📤 共有", edit_btn:"✏️ 編集", incoming_orders_title:"📦 受信した注文", no_orders_yet:"まだ注文はありません。",
    next_step_btn:"➜ 次のステップ", new_product_title:"＋ 新しい商品", price_fcfa_placeholder:"価格（FCFA）", stock_placeholder:"在庫", publish_btn:"公開する",
    new_price_placeholder:"新しい価格", new_stock_placeholder:"新しい在庫", save_btn:"保存", bureau_pro_label:"プロオフィス", my_services_title:"マイサービス", add_service_btn:"＋ サービスを追加",
    ad_fb_service_text:"サービスの\"📤 共有\"をタップし、Facebook/Instagramで\"この投稿を宣伝\"を選ぶとより多くの顧客にリーチできます（予算と支払いはFacebook上でご自身が直接管理します）。",
    tariff_label:"料金", available_label:"対応可能", unavailable_label:"対応不可", edit_tariff_btn:"✏️ 料金", pause_btn:"⏸ 一時停止", activate_btn:"▶️ 有効化",
    new_service_title:"＋ 新しいサービス", service_name_placeholder:"サービス名", tariff_fcfa_placeholder:"料金（FCFA）", short_desc_placeholder:"簡単な説明",
    edit_tariff_title:"✏️ 料金を編集", new_tariff_placeholder:"新しい料金", finish_btn:"完了", courier_label:"配達員", per_delivery_suffix:"確認済み配達ごとのポイント",
    available_deliveries_title:"📦 利用可能な配達", no_deliveries_available:"現在利用可能な配達はありません。", take_delivery_btn:"受ける",
    my_current_deliveries_title:"🚚 進行中の配達", no_deliveries_in_progress:"進行中の配達はありません。", mark_delivered_btn:"✅ 配達済みにする",
  },
  ko: {
    welcome_title:"MERCA에 오신 것을 환영합니다", welcome_sub:"테스트 시뮬레이션 - 아직 실제 SMS가 발송되지 않았습니다",
    guest_btn:"👀 계정 없이 계속하기 (제한된 접근)",
    guest_note:"계정이 없으면: 정확한 검색으로 카탈로그를 볼 수 있지만, 웰컴 포인트, 구매, PERMUTA 또는 예약 접근은 불가능합니다. 모든 기능을 잠금 해제하려면 가입하세요.",
    create_account_title:"완전한 계정 만들기", name_placeholder:"전체 이름", phone_placeholder:"전화번호", city_placeholder:"도시",
    how_use_title:"MERCA를 어떻게 사용하고 싶으신가요?", client_only_label:"고객으로만", client_only_desc:"구매하고 포인트 적립",
    details_title:"세부 정보", receive_code_btn:"SMS로 코드 받기", sending_code:"코드 전송 중... (처음에는 최대 1분, 서버가 깨어나는 중)",
    code_sent_title:"코드 전송됨:", code_sim_note:"⚠️ 테스트 시뮬레이션: 아직 실제 SMS가 발송되지 않았습니다. 아래 코드는 테스트를 위해 자동으로 입력되었습니다.",
    code_placeholder:"6자리 코드", verifying:"확인 중...", validate_btn:"확인", welcome_pts:"웰컴 포인트", edit_info_link:"← 내 정보 수정",
    lang_label:"언어",
    home_guest_mode:"게스트 모드", home_hello:"안녕하세요", home_hero_title:"야운데 - 실제 가격 우선", tag_simulation:"테스트 시뮬레이션",
    search_placeholder_exact:"정확한 상품명을 입력하세요...", found_product_title:"상품을 찾았습니다 - 실제 가격 우선", tag_product:"상품", tag_delivery:"배송",
    btn_view_product:"상품 보기", btn_alternatives:"대안", guest_catalog_hint:"게스트 모드: 상품을 찾으려면 정확한 이름을 입력하세요. 카테고리 탐색과 대안은 등록된 계정에만 제공됩니다.",
    catalog_title:"✨ 카탈로그", services_pro_title:"전문 서비스", services_pro_sub:"법률, 미용, 수리, 교육...",
    home_client_label:"고객", home_guest_label:"게스트", home_space_label:"공간", home_space_sub:"판매 / 배달",
    home_permuta_label:"PERMUTA", home_permuta_sub:"테스트 시뮬레이션", home_circle_label:"서클", home_circle_sub:"추천",
    home_settings_label:"설정", home_settings_sub:"계정, 역할, PIN", product_price_real:"실제 가격", product_commission_label:"수수료 2%", product_total_label:"합계", out_of_stock:"품절",
    reviews_word:"리뷰", product_order_btn:"주문하기 - 시뮬레이션", escrow_note:"시뮬레이션 에스크로 - 확인될 때까지 자금이 보류됩니다", confirm_title:"확인", pay_label:"결제",
    withdrawal_title:"픽업", withdrawal_btn:"🏪 매장 픽업", sending_label:"전송 중...", wallet_gate_desc:"지갑은 등록된 계정만 이용할 수 있습니다", signup_btn:"가입하기",
    unlock_pin_title:"🔐 잠금 해제 (PIN)", unlock_btn:"잠금 해제", no_order_msg:"주문 없음", no_booking_msg:"예약 없음", confirm_reception_btn:"✅ 수령 확인",
    leave_review_btn:"⭐ 리뷰 남기기", support_btn:"💬 지원 / 문제 신고", waiting_next_step:"⏳ 다음 단계를 위해 판매자/배달원을 기다리는 중",
    support_no_messages:"메시지가 없습니다. 이 주문/예약에 대해 질문이 있으면 여기에 작성하세요.", support_loading:"로딩 중...", message_placeholder:"메시지 작성...",
    report_problem_btn:"⚠️ 문제 신고", dispute_describe_placeholder:"문제를 설명하세요", send_btn:"보내기", cancel_btn:"취소", client_roles_title:"활성 역할",
    my_favorites_title:"❤️ 내 즐겨찾기", my_orders_title:"📦 내 주문", my_bookings_title:"📅 내 예약", permuta_title_banner:"🔄 PERMUTA - 테스트 시뮬레이션",
    circle_my_code_title:"나의 개인 코드", circle_invite_note:"친구를 초대하세요 - 그들이 첫 확인된 실제 주문이나 예약을 하면 당신은 받게 됩니다",
    circle_share_btn:"📤 내 코드 공유", circle_my_circle_title:"📊 내 서클", circle_invited_count:"명 초대됨", circle_active_count:"명 활성화됨 (첫 확인된 거래)",
    settings_account_title:"👤 내 계정", settings_no_phone:"번호 없음 (게스트)", settings_edit_info_btn:"내 정보 수정", settings_create_account_btn:"완전한 계정 만들기",
    settings_appearance_title:"🎨 외관", settings_dark_mode:"다크 모드", settings_notifications:"알림 (시뮬레이션)", settings_about_title:"ℹ️ 정보",
    settings_logout_btn:"🚪 로그아웃", settings_reset_btn:"🗑 모든 데이터 재설정", services_title_banner:"🧑‍💼 이용 가능한 모든 서비스", services_empty:"아직 게시된 서비스가 없습니다",
    service_reserve_btn:"예약하기 - 시뮬레이션", booking_slot_label:"시간대에 대해", confirm_booking_title:"예약 확인", confirm_and_pay_btn:"확인하고 결제", cancel_booking_btn:"예약 취소",
    espaces_hint:"회색 공간은 이 역할이 아직 활성화되지 않았음을 의미합니다 — 설정에서 활성화하세요.", espace_boutique_title:"상점 (판매자)", espace_boutique_desc:"상품 판매",
    espace_livraison_title:"배달", espace_bureau_title:"전문 사무실", espace_bureau_desc:"서비스 판매", espace_gate_desc:"판매 또는 배달에는 등록된 계정이 필요합니다",
    review_modal_title:"⭐ 리뷰 남기기", review_comment_placeholder:"댓글 (선택 사항)", review_submit_btn:"내 리뷰 보내기",
    activate_in_settings_btn:"설정에서 활성화", boutique_label:"상점", no_reviews_yet:"아직 리뷰가 없습니다", add_product_btn:"＋ 상품 추가", ad_fb_title:"📈 Facebook/Instagram 광고",
    ad_fb_product_text:"상품에서 \"📤 공유\"를 누른 다음 Facebook/Instagram에서 \"이 게시물 홍보하기\"를 선택하면 더 많은 고객에게 도달할 수 있습니다 (예산과 결제는 Facebook에서 직접 관리됩니다).",
    price_label:"가격", stock_label:"재고", share_btn:"📤 공유", edit_btn:"✏️ 수정", incoming_orders_title:"📦 받은 주문", no_orders_yet:"아직 주문이 없습니다.",
    next_step_btn:"➜ 다음 단계", new_product_title:"＋ 새 상품", price_fcfa_placeholder:"가격 (FCFA)", stock_placeholder:"재고", publish_btn:"게시",
    new_price_placeholder:"새 가격", new_stock_placeholder:"새 재고", save_btn:"저장", bureau_pro_label:"전문 사무실", my_services_title:"내 서비스", add_service_btn:"＋ 서비스 추가",
    ad_fb_service_text:"서비스에서 \"📤 공유\"를 누른 다음 Facebook/Instagram에서 \"이 게시물 홍보하기\"를 선택하면 더 많은 고객에게 도달할 수 있습니다 (예산과 결제는 Facebook에서 직접 관리됩니다).",
    tariff_label:"요금", available_label:"이용 가능", unavailable_label:"이용 불가", edit_tariff_btn:"✏️ 요금", pause_btn:"⏸ 일시 중지", activate_btn:"▶️ 활성화",
    new_service_title:"＋ 새 서비스", service_name_placeholder:"서비스 이름", tariff_fcfa_placeholder:"요금 (FCFA)", short_desc_placeholder:"간단한 설명",
    edit_tariff_title:"✏️ 요금 수정", new_tariff_placeholder:"새 요금", finish_btn:"완료", courier_label:"배달원", per_delivery_suffix:"확정 배달당 포인트",
    available_deliveries_title:"📦 이용 가능한 배달", no_deliveries_available:"현재 이용 가능한 배달이 없습니다.", take_delivery_btn:"받기",
    my_current_deliveries_title:"🚚 진행 중인 배달", no_deliveries_in_progress:"진행 중인 배달이 없습니다.", mark_delivered_btn:"✅ 배달 완료로 표시",
  },
  sw: {
    welcome_title:"Karibu MERCA", welcome_sub:"UIGAJI WA JARIBIO - hakuna SMS halisi iliyotumwa bado",
    guest_btn:"👀 Endelea bila akaunti (ufikiaji mdogo)",
    guest_note:"Bila akaunti: unaweza kuvinjari orodha kwa utafutaji sahihi, lakini bila pointi za karibu, ununuzi, ufikiaji wa PERMUTA au uhifadhi. Jisajili ili kufungua kila kitu.",
    create_account_title:"Unda akaunti kamili", name_placeholder:"Jina kamili", phone_placeholder:"Nambari ya simu", city_placeholder:"Jiji",
    how_use_title:"Unataka kutumiaje MERCA?", client_only_label:"Mteja tu", client_only_desc:"Nunua, pata pointi",
    details_title:"Maelezo", receive_code_btn:"Pokea msimbo wangu kwa SMS", sending_code:"Inatuma msimbo... (hadi dakika 1 mara ya kwanza, seva inaamka)",
    code_sent_title:"Msimbo umetumwa kwa", code_sim_note:"⚠️ UIGAJI WA JARIBIO: hakuna SMS halisi iliyotumwa bado. Msimbo hapa chini umejazwa kiotomatiki kwa ajili ya jaribio.",
    code_placeholder:"Msimbo wa tarakimu 6", verifying:"Inathibitisha...", validate_btn:"Thibitisha", welcome_pts:"pointi za karibu", edit_info_link:"← Hariri taarifa zangu",
    lang_label:"Lugha",
    home_guest_mode:"Hali ya mgeni", home_hello:"Habari", home_hero_title:"Yaoundé - Bei halisi kwanza", tag_simulation:"UIGAJI WA JARIBIO",
    search_placeholder_exact:"Andika bidhaa kamili...", found_product_title:"Bidhaa imepatikana - Bei halisi kwanza", tag_product:"Bidhaa", tag_delivery:"Uwasilishaji",
    btn_view_product:"Ona bidhaa", btn_alternatives:"Mbadala", guest_catalog_hint:"Hali ya mgeni: andika jina kamili la bidhaa ili kuipata. Kuvinjari kwa kategoria na mbadala ni kwa akaunti zilizosajiliwa tu.",
    catalog_title:"✨ Orodha", services_pro_title:"HUDUMA ZA KITAALAM", services_pro_sub:"Kisheria, urembo, ukarabati, elimu...",
    home_client_label:"MTEJA", home_guest_label:"Mgeni", home_space_label:"NAFASI", home_space_sub:"Uza / Peleka",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Uigaji wa jaribio", home_circle_label:"DUARA", home_circle_sub:"Rufaa",
    home_settings_label:"MIPANGILIO", home_settings_sub:"Akaunti, majukumu, PIN", product_price_real:"BEI HALISI", product_commission_label:"Ada 2%", product_total_label:"Jumla", out_of_stock:"Hazipo stoo",
    reviews_word:"maoni", product_order_btn:"Agiza - UIGAJI", escrow_note:"Hifadhi ya majaribio - fedha zimezuiwa hadi uthibitisho", confirm_title:"Thibitisha", pay_label:"Lipa",
    withdrawal_title:"Kuchukua", withdrawal_btn:"🏪 Kuchukua dukani", sending_label:"Inatuma...", wallet_gate_desc:"Mkoba ni kwa akaunti zilizosajiliwa tu", signup_btn:"Jisajili",
    unlock_pin_title:"🔐 Fungua (PIN)", unlock_btn:"Fungua", no_order_msg:"Hakuna agizo", no_booking_msg:"Hakuna uhifadhi", confirm_reception_btn:"✅ Thibitisha kupokea",
    leave_review_btn:"⭐ Acha maoni", support_btn:"💬 Msaada / Ripoti tatizo", waiting_next_step:"⏳ Inasubiri muuzaji/mtoa huduma kwa hatua inayofuata",
    support_no_messages:"Hakuna ujumbe. Andika hapa ikiwa una swali kuhusu agizo/uhifadhi huu.", support_loading:"Inapakia...", message_placeholder:"Andika ujumbe...",
    report_problem_btn:"⚠️ Ripoti tatizo", dispute_describe_placeholder:"Eleza tatizo", send_btn:"Tuma", cancel_btn:"Ghairi", client_roles_title:"Majukumu yanayotumika",
    my_favorites_title:"❤️ Vipendwa vyangu", my_orders_title:"📦 Maagizo yangu", my_bookings_title:"📅 Hifadhi zangu", permuta_title_banner:"🔄 PERMUTA - UIGAJI WA JARIBIO",
    circle_my_code_title:"Msimbo wako wa kibinafsi", circle_invite_note:"Alika marafiki zako - watakapofanya agizo au uhifadhi wao wa kwanza halisi uliothibitishwa, utapata",
    circle_share_btn:"📤 Shiriki msimbo wangu", circle_my_circle_title:"📊 Duara Langu", circle_invited_count:"mtu/watu waliualikwa", circle_active_count:"wamekuwa hai (muamala wa kwanza uliothibitishwa)",
    settings_account_title:"👤 Akaunti yangu", settings_no_phone:"Hakuna nambari (mgeni)", settings_edit_info_btn:"Hariri taarifa zangu", settings_create_account_btn:"Unda akaunti kamili",
    settings_appearance_title:"🎨 Mwonekano", settings_dark_mode:"Hali ya giza", settings_notifications:"Arifa (uigaji)", settings_about_title:"ℹ️ Kuhusu",
    settings_logout_btn:"🚪 Toka", settings_reset_btn:"🗑 Weka upya data zote", services_title_banner:"🧑‍💼 Huduma zote zinazopatikana", services_empty:"Hakuna huduma iliyochapishwa bado",
    service_reserve_btn:"Hifadhi - UIGAJI", booking_slot_label:"kwa nafasi", confirm_booking_title:"Thibitisha uhifadhi", confirm_and_pay_btn:"Thibitisha na ulipe", cancel_booking_btn:"Ghairi uhifadhi",
    espaces_hint:"Nafasi ya kijivu inamaanisha jukumu hili bado halijawashwa — liwashe kutoka Mipangilio.", espace_boutique_title:"Duka (Muuzaji)", espace_boutique_desc:"Kuuza bidhaa",
    espace_livraison_title:"Uwasilishaji", espace_bureau_title:"Ofisi ya Kitaalam", espace_bureau_desc:"Kuuza huduma", espace_gate_desc:"Kuuza au kuwasilisha kunahitaji akaunti iliyosajiliwa",
    review_modal_title:"⭐ Acha maoni", review_comment_placeholder:"Maoni (si lazima)", review_submit_btn:"Tuma maoni yangu",
    activate_in_settings_btn:"Washa katika Mipangilio", boutique_label:"Duka", no_reviews_yet:"Hakuna maoni bado", add_product_btn:"＋ Ongeza bidhaa", ad_fb_title:"📈 Matangazo ya Facebook/Instagram",
    ad_fb_product_text:"Bonyeza \"📤 Shiriki\" kwenye bidhaa, kisha katika Facebook/Instagram chagua \"Boost chapisho hili\" kufikia wateja zaidi (bajeti na malipo yanasimamiwa moja kwa moja na wewe kwenye Facebook).",
    price_label:"Bei", stock_label:"Stoo", share_btn:"📤 Shiriki", edit_btn:"✏️ Hariri", incoming_orders_title:"📦 Maagizo yaliyopokelewa", no_orders_yet:"Hakuna agizo kwa sasa.",
    next_step_btn:"➜ Hatua inayofuata", new_product_title:"＋ Bidhaa mpya", price_fcfa_placeholder:"Bei (FCFA)", stock_placeholder:"Stoo", publish_btn:"Chapisha",
    new_price_placeholder:"Bei mpya", new_stock_placeholder:"Stoo mpya", save_btn:"Hifadhi", bureau_pro_label:"Ofisi ya Kitaalam", my_services_title:"Huduma zangu", add_service_btn:"＋ Ongeza huduma",
    ad_fb_service_text:"Bonyeza \"📤 Shiriki\" kwenye huduma, kisha katika Facebook/Instagram chagua \"Boost chapisho hili\" kufikia wateja zaidi (bajeti na malipo yanasimamiwa moja kwa moja na wewe kwenye Facebook).",
    tariff_label:"Ada", available_label:"Inapatikana", unavailable_label:"Haipatikani", edit_tariff_btn:"✏️ Ada", pause_btn:"⏸ Simamisha", activate_btn:"▶️ Washa",
    new_service_title:"＋ Huduma mpya", service_name_placeholder:"Jina la huduma", tariff_fcfa_placeholder:"Ada (FCFA)", short_desc_placeholder:"Maelezo mafupi",
    edit_tariff_title:"✏️ Hariri ada", new_tariff_placeholder:"Ada mpya", finish_btn:"Kamilisha", courier_label:"Mtoa huduma wa usafirishaji", per_delivery_suffix:"pointi kwa kila uwasilishaji uliothibitishwa",
    available_deliveries_title:"📦 Uwasilishaji unaopatikana", no_deliveries_available:"Hakuna uwasilishaji unaopatikana kwa sasa.", take_delivery_btn:"Chukua",
    my_current_deliveries_title:"🚚 Uwasilishaji wangu unaoendelea", no_deliveries_in_progress:"Hakuna uwasilishaji unaoendelea.", mark_delivered_btn:"✅ Weka alama kuwa imewasilishwa",
  },
  ha: {
    welcome_title:"Barka da zuwa MERCA", welcome_sub:"KWAIKWAYON GWAJI - ba a aika sako na gaskiya ba tukuna",
    guest_btn:"👀 Cigaba ba tare da asusu ba (iyakacin shiga)",
    guest_note:"Ba tare da asusu ba: za ka iya duba jerin kayayyaki da bincike na daidai, amma babu maki na maraba, siye, ko damar zuwa PERMUTA ko yin ajiyar wuri. Yi rajista don buɗe komai.",
    create_account_title:"Ƙirƙiri cikakken asusu", name_placeholder:"Cikakken suna", phone_placeholder:"Lambar waya", city_placeholder:"Gari",
    how_use_title:"Yaya kake son amfani da MERCA?", client_only_label:"Abokin ciniki kawai", client_only_desc:"Saya, samu maki",
    details_title:"Bayanai", receive_code_btn:"Karɓi lambar sirri ta SMS", sending_code:"Ana aika lambar... (har zuwa minti 1 a karo na farko, uwar garke tana farkawa)",
    code_sent_title:"An aika lambar zuwa", code_sim_note:"⚠️ KWAIKWAYON GWAJI: ba a aika sako na gaskiya ba tukuna. An cika lambar da ke ƙasa ta atomatik don gwaji.",
    code_placeholder:"Lambar lambobi 6", verifying:"Ana tabbatarwa...", validate_btn:"Tabbatar", welcome_pts:"maki na maraba", edit_info_link:"← Gyara bayanaina",
    lang_label:"Harshe",
    home_guest_mode:"Yanayin baƙo", home_hello:"Sannu", home_hero_title:"Yaoundé - Ainihin farashi tukuna", tag_simulation:"KWAIKWAYON GWAJI",
    search_placeholder_exact:"Rubuta ainihin sunan kaya...", found_product_title:"An samo kaya - Ainihin farashi tukuna", tag_product:"Kaya", tag_delivery:"Isar da kaya",
    btn_view_product:"Duba kaya", btn_alternatives:"Wasu zaɓuɓɓuka", guest_catalog_hint:"Yanayin baƙo: rubuta ainihin sunan kaya don neman shi. Binciken rukuni da sauran zaɓuɓɓuka na asusun da aka yi rajista ne kawai.",
    catalog_title:"✨ Jerin kaya", services_pro_title:"AIKIN KWARARRU", services_pro_sub:"Shari'a, kayan ado, gyara, ilimi...",
    home_client_label:"ABOKIN CINIKI", home_guest_label:"Baƙo", home_space_label:"WURI", home_space_sub:"Sayarwa / Kai kaya",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Kwaikwayon gwaji", home_circle_label:"'YAN UWA", home_circle_sub:"Shawarwari",
    home_settings_label:"SAITUNAN", home_settings_sub:"Asusu, matsayi, PIN", product_price_real:"AININHIN FARASHI", product_commission_label:"Kudin sabis 2%", product_total_label:"Jimla", out_of_stock:"Babu kaya",
    reviews_word:"sharhi", product_order_btn:"Yi odar - KWAIKWAYO", escrow_note:"Ajiyar kwaikwayo - an tsare kudi har sai an tabbatar", confirm_title:"Tabbatar", pay_label:"Biya",
    withdrawal_title:"Karɓa", withdrawal_btn:"🏪 Karɓa a shago", sending_label:"Ana aikawa...", wallet_gate_desc:"Walat ɗin na asusun da aka yi rajista ne kawai", signup_btn:"Yi rajista",
    unlock_pin_title:"🔐 Buɗe (PIN)", unlock_btn:"Buɗe", no_order_msg:"Babu odar", no_booking_msg:"Babu ajiyar wuri", confirm_reception_btn:"✅ Tabbatar da karɓa",
    leave_review_btn:"⭐ Bar sharhi", support_btn:"💬 Taimako / Kai rahoton matsala", waiting_next_step:"⏳ Ana jiran mai siyarwa/mai kai kaya don mataki na gaba",
    support_no_messages:"Babu saƙo. Rubuta anan idan kana da tambaya game da wannan oda/ajiyar wuri.", support_loading:"Ana lodawa...", message_placeholder:"Rubuta saƙo...",
    report_problem_btn:"⚠️ Kai rahoton matsala", dispute_describe_placeholder:"Bayyana matsalar", send_btn:"Aika", cancel_btn:"Soke", client_roles_title:"Matsayi masu aiki",
    my_favorites_title:"❤️ Abubuwan da nake so", my_orders_title:"📦 Odar na", my_bookings_title:"📅 Ajiyar wurina", permuta_title_banner:"🔄 PERMUTA - KWAIKWAYON GWAJI",
    circle_my_code_title:"Lambar sirri ta ka", circle_invite_note:"Gayyaci abokanka - idan sun yi odar ko ajiyar wuri na farko na gaskiya da aka tabbatar, za ka samu",
    circle_share_btn:"📤 Raba lambar sirri ta", circle_my_circle_title:"📊 'Yan Uwana", circle_invited_count:"mutum(mutane) da aka gayyata", circle_active_count:"sun zama masu aiki (ciniki na farko da aka tabbatar)",
    settings_account_title:"👤 Asusuna", settings_no_phone:"Babu lamba (baƙo)", settings_edit_info_btn:"Gyara bayanaina", settings_create_account_btn:"Ƙirƙiri cikakken asusu",
    settings_appearance_title:"🎨 Kamanni", settings_dark_mode:"Yanayin duhu", settings_notifications:"Sanarwa (kwaikwayo)", settings_about_title:"ℹ️ Game da",
    settings_logout_btn:"🚪 Fita", settings_reset_btn:"🗑 Sake saita duk bayanai", services_title_banner:"🧑‍💼 Duk ayyukan da ake da su", services_empty:"Babu wani aiki da aka buga tukuna",
    service_reserve_btn:"Yi ajiya - KWAIKWAYO", booking_slot_label:"don lokacin", confirm_booking_title:"Tabbatar da ajiyar wuri", confirm_and_pay_btn:"Tabbatar kuma biya", cancel_booking_btn:"Soke ajiyar wuri",
    espaces_hint:"Fili mai launin toka yana nufin ba a kunna wannan matsayi ba tukuna — kunna shi daga Saituna.", espace_boutique_title:"Shago (Mai siyarwa)", espace_boutique_desc:"Sayar da kayayyaki",
    espace_livraison_title:"Isar da kaya", espace_bureau_title:"Ofishin Kwararru", espace_bureau_desc:"Sayar da aiki", espace_gate_desc:"Siyarwa ko kai kaya na buƙatar asusun da aka yi rajista",
    review_modal_title:"⭐ Bar sharhi", review_comment_placeholder:"Sharhi (ba dole ba)", review_submit_btn:"Aika sharhi na",
    activate_in_settings_btn:"Kunna a Saituna", boutique_label:"Shago", no_reviews_yet:"Babu sharhi tukuna", add_product_btn:"＋ Ƙara kaya", ad_fb_title:"📈 Tallan Facebook/Instagram",
    ad_fb_product_text:"Danna \"📤 Raba\" akan kaya, sannan a Facebook/Instagram zaɓi \"Haɓaka wannan sakon\" don isa ga abokan ciniki da yawa (kasafin kuɗi da biya ana sarrafa su kai tsaye da kai a Facebook).",
    price_label:"Farashi", stock_label:"Kaya", share_btn:"📤 Raba", edit_btn:"✏️ Gyara", incoming_orders_title:"📦 Odar da aka samu", no_orders_yet:"Babu oda a halin yanzu.",
    next_step_btn:"➜ Mataki na gaba", new_product_title:"＋ Sabon kaya", price_fcfa_placeholder:"Farashi (FCFA)", stock_placeholder:"Kaya", publish_btn:"Buga",
    new_price_placeholder:"Sabon farashi", new_stock_placeholder:"Sabon kaya", save_btn:"Ajiye", bureau_pro_label:"Ofishin Kwararru", my_services_title:"Ayyukana", add_service_btn:"＋ Ƙara aiki",
    ad_fb_service_text:"Danna \"📤 Raba\" akan aiki, sannan a Facebook/Instagram zaɓi \"Haɓaka wannan sakon\" don isa ga abokan ciniki da yawa (kasafin kuɗi da biya ana sarrafa su kai tsaye da kai a Facebook).",
    tariff_label:"Kudin sabis", available_label:"Akwai", unavailable_label:"Babu", edit_tariff_btn:"✏️ Kudin sabis", pause_btn:"⏸ Dakata", activate_btn:"▶️ Kunna",
    new_service_title:"＋ Sabon aiki", service_name_placeholder:"Sunan aiki", tariff_fcfa_placeholder:"Kudin sabis (FCFA)", short_desc_placeholder:"Taƙaitaccen bayani",
    edit_tariff_title:"✏️ Gyara kudin sabis", new_tariff_placeholder:"Sabon kudin sabis", finish_btn:"Kammala", courier_label:"Mai kai kaya", per_delivery_suffix:"maki a kowace isarwar da aka tabbatar",
    available_deliveries_title:"📦 Isar da kaya da ake da su", no_deliveries_available:"Babu isar da kaya a halin yanzu.", take_delivery_btn:"Ɗauka",
    my_current_deliveries_title:"🚚 Isar da kayana na yanzu", no_deliveries_in_progress:"Babu isar da kaya a ci gaba.", mark_delivered_btn:"✅ Alamta an kai",
  },
  ff: {
    welcome_title:"Bisimillah e MERCA", welcome_sub:"KWAAKUNKUN TESTINGO - SMS goonga alaa jaltugo",
    guest_btn:"👀 Jokku ko alaa konte (jokkondiral seeɗa)",
    guest_note:"Ko alaa konte : a waawi ƴeewde catalog nden e njiilaw feccere, kono maki weltaare alaa, njeeygu alaa, jokkondiral e PERMUTA walla reservation alaa. Winndito ngam udditde fof.",
    create_account_title:"Sos konte timmunde", name_placeholder:"Innde timmunde", phone_placeholder:"Limngal telefon", city_placeholder:"Saare",
    how_use_title:"No njiɗɗaa huutoraade MERCA?", client_only_label:"Kiliyaan tan", client_only_desc:"Soodde, heɓde maki",
    details_title:"Ɓataake keewɗo", receive_code_btn:"Jaɓɓo kod am to SMS", sending_code:"Ena nulaa kod... (haa 1 minit sahaa arana, serwer ena finndoo)",
    code_sent_title:"Kod nulanaama to", code_sim_note:"⚠️ KWAAKUNKUN TESTINGO: SMS goonga alaa jaltugo. Kod ley ɗo heewnii ko-toon ngam test.",
    code_placeholder:"Kod mbatuuji 6", verifying:"Ena seedee...", validate_btn:"Tabtin", welcome_pts:"maki weltaare", edit_info_link:"← Baylu kumpital am",
    lang_label:"Ɗemngal",
    home_guest_mode:"Jaɓɓorde seteende", home_hello:"Jam waali", home_hero_title:"Yaoundé - Coggu goonga arande", tag_simulation:"KWAAKUNKUN TESTINGO",
    search_placeholder_exact:"Winndu innde tagoo nden...", found_product_title:"Tagoo heɓaama - Coggu goonga arande", tag_product:"Tagoo", tag_delivery:"Yottingol",
    btn_view_product:"Yiy tagoo", btn_alternatives:"Goɗɗi", guest_catalog_hint:"Jaɓɓorde seteende : winndu innde tagoo nden ngam yiyde mo. Yiiloygo e catégorie e goɗɗi ko konte winnditaaɗe tan.",
    catalog_title:"✨ Catalog", services_pro_title:"GOLLE KWARAARU", services_pro_sub:"Sariya, newnugol, ñiiɓngol, janngingol...",
    home_client_label:"KILIYAAN", home_guest_label:"Seteende", home_space_label:"NOKKU", home_space_sub:"Soodde / Yottin",
    home_permuta_label:"PERMUTA", home_permuta_sub:"Kwaakunkun testingo", home_circle_label:"DARUNDE", home_circle_sub:"Yamiroore",
    home_settings_label:"TEELTAL", home_settings_sub:"Konte, geɗe, PIN", product_price_real:"COGGU GOONGA", product_commission_label:"Fee 2%", product_total_label:"Fof", out_of_stock:"Alaa e conservation",
    reviews_word:"sellugol", product_order_btn:"Yamir - KWAAKUNKUN", escrow_note:"Deposit kwaakunkun - kaalisi ɗen ko hoyaama haa tabitinol", confirm_title:"Tabtin", pay_label:"Yoɓu",
    withdrawal_title:"Ƴeewtugol", withdrawal_btn:"🏪 Ƴeewtugol to magasin", sending_label:"Ena nulee...", wallet_gate_desc:"Walɛt ko konte winnditaaɗe tan", signup_btn:"Winndito",
    unlock_pin_title:"🔐 Udditu (PIN)", unlock_btn:"Udditu", no_order_msg:"Yamiroore alaa", no_booking_msg:"Reservation alaa", confirm_reception_btn:"✅ Tabtin heɓugol",
    leave_review_btn:"⭐ Accu sellugol", support_btn:"💬 Ballal / Yiylo caɗeele", waiting_next_step:"⏳ Ena habbindaa coodoowo/nulooɗo ngam deental garowal",
    support_no_messages:"Alaa kabaruuji. Winndu ɗoo si a mari naamnal fii yamiroore/reservation nden.", support_loading:"Ena lodee...", message_placeholder:"Winndu kabaaru...",
    report_problem_btn:"⚠️ Yiylo caɗeele", dispute_describe_placeholder:"Firtu caɗeele nden", send_btn:"Nuli", cancel_btn:"Haaytu", client_roles_title:"Darja gollotooɗi",
    my_favorites_title:"❤️ Ko mi yiɗi", my_orders_title:"📦 Yamirooje am", my_bookings_title:"📅 Reservation am", permuta_title_banner:"🔄 PERMUTA - KWAAKUNKUN TESTINGO",
    circle_my_code_title:"Kod ma seetiiɗo", circle_invite_note:"Noddu sehalaaɓe maa - si ɓe waɗi yamiroore walla reservation maɓɓe adanndeere goonga tabitinaande, a heɓay",
    circle_share_btn:"📤 Taggitin kod am", circle_my_circle_title:"📊 Darunde am", circle_invited_count:"neɗɗo(ɓe) noddaaɓe", circle_active_count:"wonii gollotooɓe (jeyal adanndeejo tabitinaango)",
    settings_account_title:"👤 Konte am", settings_no_phone:"Limngal alaa (seteende)", settings_edit_info_btn:"Baylu kumpital am", settings_create_account_btn:"Sos konte timmunde",
    settings_appearance_title:"🎨 Yiyannde", settings_dark_mode:"Mode niɓɓam", settings_notifications:"Tintinooje (kwaakunkun)", settings_about_title:"ℹ️ Fii",
    settings_logout_btn:"🚪 Yaltu", settings_reset_btn:"🗑 Momtu daŋol fof", services_title_banner:"🧑‍💼 Golle kewɗe fof", services_empty:"Golle alaa jaltunde tawo",
    service_reserve_btn:"Reservation - KWAAKUNKUN", booking_slot_label:"ngam sahaa", confirm_booking_title:"Tabtin reservation", confirm_and_pay_btn:"Tabtin kuma yoɓu", cancel_booking_btn:"Haaytu reservation",
    espaces_hint:"Nokku boɗeejo firti ko darja ɗii fuɗɗaaki udditeede - udditu ɗum e Teeltal.", espace_boutique_title:"Magasin (Coodoowo)", espace_boutique_desc:"Soodde kaayitaaji",
    espace_livraison_title:"Yottingol", espace_bureau_title:"Nokku Kwararu", espace_bureau_desc:"Soodde golle", espace_gate_desc:"Soodde walla yottingol ina waɗɗii konte winnditaande",
    review_modal_title:"⭐ Accu sellugol", review_comment_placeholder:"Yowitaari (si a yiɗi)", review_submit_btn:"Nuli sellugol am",
    activate_in_settings_btn:"Udditu e Teeltal", boutique_label:"Magasin", no_reviews_yet:"Sellugol alaa tawo", add_product_btn:"＋ Ɓeydu kaayit", ad_fb_title:"📈 Piblisite Facebook/Instagram",
    ad_fb_product_text:"Downdu \"📤 Taggit\" e kaayit, refti e Facebook/Instagram suɓo \"Ɓoostu binndannde ndee\" ngam yottaade e geɗɗo ɓurɗo (coggu e yoɓde ko aan heen tigi tigi e Facebook).",
    price_label:"Coggu", stock_label:"Konservasiyon", share_btn:"📤 Taggit", edit_btn:"✏️ Baylu", incoming_orders_title:"📦 Yamirooje heɓaaɗe", no_orders_yet:"Yamiroore alaa jooni.",
    next_step_btn:"➜ Garowal yeeso", new_product_title:"＋ Kaayit kesum", price_fcfa_placeholder:"Coggu (FCFA)", stock_placeholder:"Konservasiyon", publish_btn:"Winndit",
    new_price_placeholder:"Coggu kesum", new_stock_placeholder:"Konservasiyon kesun", save_btn:"Mooftu", bureau_pro_label:"Nokku Kwararu", my_services_title:"Golle am", add_service_btn:"＋ Ɓeydu golle",
    ad_fb_service_text:"Downdu \"📤 Taggit\" e golle, refti e Facebook/Instagram suɓo \"Ɓoostu binndannde ndee\" ngam yottaade e geɗɗo ɓurɗo (coggu e yoɓde ko aan heen tigi tigi e Facebook).",
    tariff_label:"Coggol", available_label:"Hino", unavailable_label:"Alaa", edit_tariff_btn:"✏️ Coggol", pause_btn:"⏸ Dartin", activate_btn:"▶️ Udditu",
    new_service_title:"＋ Golle kesum", service_name_placeholder:"Innde golle", tariff_fcfa_placeholder:"Coggol (FCFA)", short_desc_placeholder:"Firtugol famɗuɗo",
    edit_tariff_title:"✏️ Baylu coggol", new_tariff_placeholder:"Coggol kesum", finish_btn:"Timmin", courier_label:"Nulooɗo", per_delivery_suffix:"peenval ngam yottingol tabitinaango",
    available_deliveries_title:"📦 Yottingol hino", no_deliveries_available:"Yottingol alaa jooni.", take_delivery_btn:"Nangu",
    my_current_deliveries_title:"🚚 Yottingol am ngonduɗo", no_deliveries_in_progress:"Yottingol ngonduɗo alaa.", mark_delivered_btn:"✅ Maantin wonaa yottaama",
  },
};

// Métadonnées des langues pour le sélecteur (drapeau + nom affiché) - garde le
// même ordre que dans I18N. Les 2 premières sont les langues officielles du
// Cameroun ; les 15 suivantes sont les langues étrangères ajoutées pour les
// visiteurs internationaux pendant leur séjour au Cameroun.
const LANGUAGES = [
  { code:"fr", flag:"🇫🇷", label:"Français" },
  { code:"en", flag:"🇬🇧", label:"English" },
  { code:"es", flag:"🇪🇸", label:"Español" },
  { code:"pt", flag:"🇵🇹", label:"Português" },
  { code:"ar", flag:"🇸🇦", label:"العربية" },
  { code:"zh", flag:"🇨🇳", label:"中文" },
  { code:"de", flag:"🇩🇪", label:"Deutsch" },
  { code:"it", flag:"🇮🇹", label:"Italiano" },
  { code:"tr", flag:"🇹🇷", label:"Türkçe" },
  { code:"ru", flag:"🇷🇺", label:"Русский" },
  { code:"hi", flag:"🇮🇳", label:"हिन्दी" },
  { code:"ja", flag:"🇯🇵", label:"日本語" },
  { code:"ko", flag:"🇰🇷", label:"한국어" },
  { code:"sw", flag:"🌍", label:"Kiswahili" },
  { code:"ha", flag:"🌍", label:"Hausa" },
  { code:"ff", flag:"🌍", label:"Fulfulde" },
];

const INITIAL_PRODUCTS = [
  {id:"p1",name:"iPhone X 64Go",price:95000,cat:"Téléphones",shop:"Merca Mobile",rating:4.7,stock:5,desc:"Bon état 88% - Yaoundé Bastos",ville:"Yaoundé",rayon:0.5,last:0,img:IMG.iphone},
  {id:"p2",name:"Samsung A54 128Go",price:85000,cat:"Téléphones",shop:"Merca Mobile",rating:4.8,stock:8,desc:"Neuf scellé",ville:"Yaoundé",rayon:1.2,last:0,img:IMG.samsung},
  {id:"p3",name:"MacBook Air M1",price:420000,cat:"Informatique",shop:"Merca Tech",rating:4.9,stock:2,desc:"8Go/256Go",ville:"Yaoundé",rayon:0.9,last:0,img:IMG.pc},
  {id:"p4",name:"JBL Flip 6",price:35000,cat:"Électronique",shop:"Merca Audio",rating:4.5,stock:12,desc:"Étanche IPX7",ville:"Yaoundé",rayon:0.4,last:0,img:IMG.baffle},
  {id:"p5",name:"Canapé velours 3P",price:150000,cat:"Meubles",shop:"Merca Maison",rating:4.9,stock:2,desc:"Velours premium",ville:"Yaoundé",rayon:1.5,last:0,img:IMG.canape},
];

function uid(prefix){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
// Transforme le PIN en empreinte illisible (hash) avant de le stocker - même
// en cas d'accès au stockage du téléphone, le vrai PIN ne peut pas être retrouvé.
// Fait en JavaScript pur (pas de module natif) pour éviter tout souci de
// compatibilité avec Expo Go - suffisant ici car ce PIN ne verrouille que
// l'accès local ; les vraies transactions passent par le serveur, protégées
// par le jeton de connexion (accessToken), stocké lui dans l'espace chiffré.
async function hashPin(pin){
  let hash = 0x811c9dc5;
  const salted = "MERCA_SALT_"+pin;
  for(let i=0;i<salted.length;i++){ hash ^= salted.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash>>>0).toString(16);
}
function genUniqueCode(existingList, field){
  const used = new Set(existingList.map(o=>o[field]));
  let code; do { code = Math.floor(1000+Math.random()*9000).toString(); } while(used.has(code));
  return code;
}
// Génère 4 créneaux simples (pas de vrai calendrier ici, juste des options claires)
function genSlots(){
  const now=new Date(); const opts=[];
  for(let d=1; d<=2; d++){
    for(const h of [9,14]){
      const dt=new Date(now); dt.setDate(dt.getDate()+d); dt.setHours(h,0,0,0);
      opts.push({ id:`${d}-${h}`, label:`${d===1?"Demain":"Après-demain"} ${h}h00`, at:dt.getTime() });
    }
  }
  return opts;
}

export default function App(){
  const [ready,setReady]=useState(false);
  const [user,setUser]=useState(null); // null = écran d'accueil (choix inscription / invité)

  const [page,setPage]=useState("home"); const [hist,setHist]=useState([]);
  const [products,setProducts]=useState(INITIAL_PRODUCTS);
  const [services,setServices]=useState([]);
  const [search,setSearch]=useState(""); const [debouncedSearch,setDebouncedSearch]=useState("");
  const [cat,setCat]=useState("Tous"); const [ville,setVille]=useState("Yaoundé"); const [rayon,setRayon]=useState(5);
  const [selected,setSelected]=useState(null); const [selectedService,setSelectedService]=useState(null); const [selectedSlot,setSelectedSlot]=useState(null);
  const [orders,setOrders]=useState([]); const [selectedOrder,setSelectedOrder]=useState(null);
  // Listes réelles côté commerçant (commandes reçues) et côté livreur
  // (livraisons disponibles à prendre + celles déjà assignées à moi)
  const [incomingOrders,setIncomingOrders]=useState([]);
  const [incomingBookings,setIncomingBookings]=useState([]);
  const [availableDeliveries,setAvailableDeliveries]=useState([]);
  const [myDeliveries,setMyDeliveries]=useState([]);
  const [bookings,setBookings]=useState([]); const [selectedBooking,setSelectedBooking]=useState(null);
  const [wallet,setWallet]=useState(25000); const [points,setPoints]=useState(0); const [orDate,setOrDate]=useState(null);
  const [walletHistory,setWalletHistory]=useState([]);
  const [walletPin,setWalletPin]=useState(null); // stocke une empreinte (hash), jamais le PIN en clair
  const [pinInput,setPinInput]=useState(""); const [fails,setFails]=useState(0); const [blocked,setBlocked]=useState(0);
  const [permuta]=useState([{id:"pm1",name:"iPhone X contre Samsung",owner:"Client A",status:"Disponible",img1:IMG.iphone,img2:IMG.samsung}]);
  const [showAlternatives,setShowAlternatives]=useState(false);
  const [favorites,setFavorites]=useState([]);
  const [dark,setDark]=useState(false);
  const [lang,setLang]=useState("fr");
  const t=(key)=> (I18N[lang] && I18N[lang][key]) || I18N.fr[key] || key;
  const [notifEnabled,setNotifEnabled]=useState(true);
  const [reviews,setReviews]=useState([]); const [messages,setMessages]=useState([]); const [disputes,setDisputes]=useState([]);

  const [showAdd,setShowAdd]=useState(false); const [npName,setNpName]=useState(""); const [npPrice,setNpPrice]=useState(""); const [npCat,setNpCat]=useState("Électronique"); const [npStock,setNpStock]=useState("1");
  const [showEdit,setShowEdit]=useState(null); const [editPrice,setEditPrice]=useState(""); const [editStock,setEditStock]=useState("");

  const [showAddService,setShowAddService]=useState(false); const [nsName,setNsName]=useState(""); const [nsPrice,setNsPrice]=useState(""); const [nsDomaine,setNsDomaine]=useState(PRO_DOMAINES[0]); const [nsDesc,setNsDesc]=useState("");
  const [showEditService,setShowEditService]=useState(null); const [esPrice,setEsPrice]=useState("");

  const [regName,setRegName]=useState(""); const [regPhone,setRegPhone]=useState(""); const [regCity,setRegCity]=useState("Yaoundé");
  // Indicatif téléphonique choisi par l'utilisateur (Cameroun par défaut) +
  // visibilité de la fenêtre de sélection + texte de recherche dans la liste
  const [regCountryCode,setRegCountryCode]=useState("+237");
  const [showCountryPicker,setShowCountryPicker]=useState(false);
  const [countrySearch,setCountrySearch]=useState("");
  const [regRole,setRegRole]=useState(null); const [regExtra,setRegExtra]=useState(""); const [regDomaine,setRegDomaine]=useState(PRO_DOMAINES[0]);
  const [regReferralCode,setRegReferralCode]=useState(""); // MERCA CERCLE : code du parrain (facultatif, à l'inscription)
  const [referralAutoFilled,setReferralAutoFilled]=useState(false); // pour afficher "détecté automatiquement" à l'utilisateur

  // Détecte automatiquement un code de parrainage copié (ex: la personne a
  // copié le message d'invitation reçu par WhatsApp/SMS) - évite d'avoir à
  // le taper à la main, donc moins d'erreurs de frappe.
  useEffect(()=>{
    if(user || otpStep!=="form" || authMode!=="register" || regReferralCode) return;
    (async()=>{
      try{
        const text = await Clipboard.getStringAsync();
        const match = text && text.match(/code\s+([A-Z0-9]{6})/i);
        if(match){ setRegReferralCode(match[1].toUpperCase()); setReferralAutoFilled(true); }
      }catch(e){ /* presse-papier indisponible - pas grave, saisie manuelle reste possible */ }
    })();
  },[user, otpStep, authMode]);
  // ---- Connexion réelle au serveur (OTP = code à usage unique envoyé par SMS) ----
  const [accessToken,setAccessToken]=useState(null);
  const [otpStep,setOtpStep]=useState("form"); // "form" = saisie infos, "code" = saisie du code reçu
  const [authMode,setAuthMode]=useState("register"); // "register" = créer un compte, "login" = compte déjà existant
  // ---- Multi-comptes ----
  const [savedAccounts,setSavedAccounts]=useState([]); // liste des comptes gardés sur ce téléphone
  const [showAccountSwitcher,setShowAccountSwitcher]=useState(false);
  const [showLangPicker,setShowLangPicker]=useState(false);
  const [otpCode,setOtpCode]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [authError,setAuthError]=useState("");

  const [roleModal,setRoleModal]=useState(null); const [roleExtra,setRoleExtra]=useState(""); const [roleDomaine,setRoleDomaine]=useState(PRO_DOMAINES[0]);
  const [showAccountEdit,setShowAccountEdit]=useState(false); const [accName,setAccName]=useState(""); const [accPhone,setAccPhone]=useState(""); const [accCity,setAccCity]=useState("");
  const [showPinChange,setShowPinChange]=useState(false); const [newPin,setNewPin]=useState(""); const [newPinConfirm,setNewPinConfirm]=useState("");

  // Avis
  const [reviewModal,setReviewModal]=useState(null); // {targetName, refId}
  const [reviewRating,setReviewRating]=useState(5); const [reviewComment,setReviewComment]=useState("");

  // Protection anti double-commande/double-paiement : empêche un deuxième
  // appui (ou un deuxième appel) de partir vers le serveur tant que le
  // premier n'est pas terminé - même si l'app entière a déjà une sécurité
  // serveur pour ça, cette garde évite d'envoyer deux fois la demande.
  const [orderSubmitting,setOrderSubmitting]=useState(false);
  const [bookingSubmitting,setBookingSubmitting]=useState(false);

  // Support (messagerie + litige)
  const [supportThread,setSupportThread]=useState(null); // id de commande ou réservation
  const [messageInput,setMessageInput]=useState("");
  const [showDisputeForm,setShowDisputeForm]=useState(false); const [disputeReason,setDisputeReason]=useState(DISPUTE_REASONS[0]); const [disputeDesc,setDisputeDesc]=useState("");

  // Vérification d'identité (KYC)
  const [kycModal,setKycModal]=useState(null); const [kycDoc,setKycDoc]=useState("");

  // ---- Administration MERCA (toi uniquement) ----
  const [adminStats,setAdminStats]=useState(null);
  const [adminUsers,setAdminUsers]=useState([]);
  // Jamais sauvegardé nulle part (ni AsyncStorage, ni espace chiffré) -
  // redemandé à chaque fois que l'écran admin est ouvert, pour que l'accès à
  // cette zone ne dépende pas uniquement d'un téléphone déverrouillé.
  const [adminPasswordInput,setAdminPasswordInput]=useState("");
  const [adminUnlocked,setAdminUnlocked]=useState(null); // le mot de passe une fois validé, utilisé pour les appels
  const [adminError,setAdminError]=useState("");
  const unlockAdmin=async()=>{
    if(!adminPasswordInput.trim()) return;
    setAdminError("");
    try{
      const [s,u]=await Promise.all([apiAdminStats(accessToken,adminPasswordInput.trim()),apiAdminUsers(accessToken,adminPasswordInput.trim())]);
      setAdminStats(s); setAdminUsers(u); setAdminUnlocked(adminPasswordInput.trim()); setAdminPasswordInput("");
    }catch(e){ setAdminError(e.message); }
  };
  const refreshAdmin=async()=>{ if(!accessToken || !user?.isAdmin || !adminUnlocked) return; try{ const [s,u]=await Promise.all([apiAdminStats(accessToken,adminUnlocked),apiAdminUsers(accessToken,adminUnlocked)]); setAdminStats(s); setAdminUsers(u); }catch(e){} };

  // ---- MERCA CERCLE (parrainage) ----
  const [circleData,setCircleData]=useState(null);
  const refreshCircle=async()=>{ if(!accessToken) return; try{ const c=await apiMyCircle(accessToken); setCircleData(c); }catch(e){} };
  const shareCircleCode=()=>{
    if(!circleData) return;
    Share.share({ message: `🎁 Rejoins-moi sur MERCA !\n\nUtilise mon code ${circleData.code} à l'inscription.\n\n📲 Télécharge l'app et commence à acheter, vendre ou livrer sur MERCA.` }).catch(()=>{});
  };
  const adminToggleSuspend=async(u)=>{ try{ const updated=await apiAdminSuspend(accessToken,adminUnlocked,u.id); setAdminUsers(us=>us.map(x=>x.id===u.id?updated:x)); }catch(e){ Alert.alert("Erreur",e.message); } };
  const adminVerifyRole=async(u,role)=>{ try{ const updated=await apiAdminVerify(accessToken,adminUnlocked,u.id,role); setAdminUsers(us=>us.map(x=>x.id===u.id?updated:x)); }catch(e){ Alert.alert("Erreur",e.message); } };
  const adminToggleAdminRights=async(u)=>{ try{ const updated=await apiAdminToggleAdmin(accessToken,adminUnlocked,u.id); setAdminUsers(us=>us.map(x=>x.id===u.id?updated:x)); }catch(e){ Alert.alert("Erreur",e.message); } };
  const [adminDetail,setAdminDetail]=useState(null); // détail complet du compte sélectionné
  const adminViewDetail=async(u)=>{ try{ const d=await apiAdminUserDetail(accessToken,adminUnlocked,u.id); setAdminDetail(d); }catch(e){ Alert.alert("Erreur",e.message); } };
  const [showWalletAdjust,setShowWalletAdjust]=useState(null); const [walletAdjustAmount,setWalletAdjustAmount]=useState("");
  const submitWalletAdjust=async()=>{
    const amount=parseFloat(walletAdjustAmount);
    if(isNaN(amount) || amount===0) return Alert.alert("Erreur","Montant invalide (positif pour créditer, négatif pour débiter)");
    try{
      await apiAdminWalletAdjust(accessToken,adminUnlocked,showWalletAdjust.id,amount);
      setShowWalletAdjust(null); setWalletAdjustAmount("");
      Alert.alert("Fait","Portefeuille ajusté");
    }catch(e){ Alert.alert("Erreur",e.message); }
  };

  // ---- Chargement / sauvegarde ----
  useEffect(()=>{ apiWakeUp(); },[]); // réveille le serveur dès l'ouverture de l'app
  // Charge les vrais produits du serveur et les ajoute à ceux de démonstration
  // (ceux de démo restent visibles pour ne rien casser, mais ne sont pas sur le serveur)
  useEffect(()=>{ (async()=>{
    try{
      const serverProducts = await apiGetProducts();
      setProducts(ps=>{
        const demoOnly = ps.filter(p=>!p.merchantId);
        return [...serverProducts.map(serverToLocalProduct), ...demoOnly];
      });
    }catch(e){ /* pas grave - le catalogue de démo reste affiché */ }
  })(); },[]);
  useEffect(()=>{ (async()=>{
    try{
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if(raw){
        const s = JSON.parse(raw);
        if(s.user!==undefined) setUser(s.user);
        if(s.products) setProducts(s.products);
        if(s.services) setServices(s.services);
        if(s.orders) setOrders(s.orders);
        if(s.bookings) setBookings(s.bookings);
        if(typeof s.wallet==="number") setWallet(s.wallet);
        if(typeof s.points==="number") setPoints(s.points);
        if(s.orDate) setOrDate(s.orDate);
        if(s.walletHistory) setWalletHistory(s.walletHistory);
        if(s.walletPin) setWalletPin(s.walletPin); // c'est déjà un hash, jamais le PIN en clair
        if(s.favorites) setFavorites(s.favorites);
        if(typeof s.dark==="boolean") setDark(s.dark);
        if(s.lang) setLang(s.lang);
        if(typeof s.notifEnabled==="boolean") setNotifEnabled(s.notifEnabled);
        if(s.reviews) setReviews(s.reviews);
        if(s.messages) setMessages(s.messages);
        if(s.disputes) setDisputes(s.disputes);
      }
      // Si aucun PIN n'a encore été défini, on prépare l'empreinte du PIN par
      // défaut "1234" (jamais stocké en clair, même la toute première fois)
      if(!walletPin){ const defaultHash = await hashPin("1234"); setWalletPin(h=>h||defaultHash); }
      // Le jeton de connexion est stocké séparément, dans un espace chiffré du
      // téléphone (Keychain iOS / Keystore Android) - plus sûr qu'un simple fichier
      const savedToken = await SecureStore.getItemAsync("merca_access_token").catch(()=>null);
      if(savedToken) setAccessToken(savedToken);
      // Multi-comptes : recharge la liste des comptes déjà gardés sur ce téléphone
      const accountsList = await getSavedAccountsList();
      setSavedAccounts(accountsList);
    }catch(e){ /* SIMULATION - lecture échouée, valeurs par défaut conservées */ }
    setReady(true);
  })(); },[]);

  useEffect(()=>{
    if(!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user, products, services, orders, bookings, wallet, points, orDate, walletHistory, walletPin, favorites, dark, lang, notifEnabled, reviews, messages, disputes })).catch(()=>{});
  },[ready, user, products, services, orders, bookings, wallet, points, orDate, walletHistory, walletPin, favorites, dark, lang, notifEnabled, reviews, messages, disputes]);

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedSearch(search),300); return ()=>clearTimeout(t); },[search]);
  // Recherche intelligente côté serveur (tolère les fautes de frappe, priorise
  // la proximité) - si elle échoue ou ne trouve rien, on retombe sur la
  // recherche locale simple pour ne jamais laisser l'utilisateur bloqué.
  const [smartResults,setSmartResults]=useState(null);
  useEffect(()=>{
    if(debouncedSearch===''){ setSmartResults(null); return; }
    let cancelled=false;
    apiSmartSearch(debouncedSearch, accessToken).then(r=>{
      if(!cancelled) setSmartResults(r.results.map(serverToLocalProduct));
    }).catch(()=>{ if(!cancelled) setSmartResults(null); });
    return ()=>{ cancelled=true; };
  },[debouncedSearch, accessToken]);

  const nav=(n)=>{ if(n===page) return; setHist(h=>[...h,page]); setPage(n); };
  // Rafraîchit automatiquement la bonne liste de commandes/réservations selon l'écran ouvert
  useEffect(()=>{
    if(page==="merchant") refreshIncomingOrders();
    if(page==="courier"){ refreshAvailableDeliveries(); refreshMyDeliveries(); }
    if(page==="orders" || page==="client") { refreshMyOrders(); refreshMyBookings(); }
    if(page==="pro") { refreshServices(); refreshBookingsToFulfill(); }
    if(page==="home") refreshServices();
    if(page==="admin") refreshAdmin();
    if(page==="circle") refreshCircle();
    if(page==="product" && selected?.merchantId) loadRating(selected.merchantId);
    if(page==="merchant" && user?.id) loadRating(user.id);
    if(page==="services") dispoServices.forEach(s=>loadRating(s.proId));
    if(page==="serviceDetail" && selectedService?.proId) loadRating(selectedService.proId);
    if(page==="pro" && user?.id) loadRating(user.id);
  },[page, accessToken]);
  const back=()=>{ if(hist.length===0){ setPage("home"); return; } setPage(hist[hist.length-1]); setHist(h=>h.slice(0,-1)); };
  const home=()=>{ setHist([]); setPage("home"); };
  const money=(v)=>Number(v||0).toLocaleString("fr-FR")+" FCFA";
  // Combine l'indicatif choisi dans le sélecteur de pays (regCountryCode)
  // avec le numéro tapé. Si l'utilisateur a quand même tapé son indicatif
  // lui-même (ex: "+33..." ou "00237..."), on le respecte tel quel plutôt
  // que de doubler l'indicatif.
  const normalizePhone=(raw)=>{
    let p=(raw||"").trim().replace(/[\s-]/g,"");
    if(p.startsWith("00")) p="+"+p.slice(2);
    if(p.startsWith("+")) return p;
    return regCountryCode + p.replace(/^0/,"");
  };
  // Nettoie une description avant affichage client/partage : supprime toute
  // trace d'un ancien texte "Prix bloqué Xj" (info interne réservée au commerçant/pro)
  const cleanDesc=(d)=> (d||"").replace(/prix bloqu[ée]\s*\d+\s*j[^.\n]*\.?/gi,"").trim();

  // Reconstitue le format utilisé par l'app à partir d'une commande du serveur
  // (le serveur ne connaît que les identifiants, pas les noms/images -
  // on retrouve le produit correspondant dans le catalogue déjà chargé)
  const serverToLocalOrder=(o)=>{
    const product = products.find(p=>p.id===o.productId) || { name:"Produit", img:IMG.boutique, price:Number(o.price) };
    return { id:o.id, codeLivraison:o.deliveryCode, product, delivery: Number(o.deliveryFee)>0?"Livraison MERCA":"Retrait boutique", com:Number(o.commission), base:Number(o.deliveryFee), total:Number(o.total), status:o.status, step:o.step, merchant:product.shop||"", merchantId:o.merchantId, courierId:o.courierId, splitCourier:Number(o.splitCourier), splitMerchant:Number(o.splitMerchant) };
  };
  const refreshMyOrders=async()=>{ if(!accessToken) return; try{ const list=await apiGetMyOrders(accessToken); setOrders(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshIncomingOrders=async()=>{ if(!accessToken) return; try{ const list=await apiGetOrdersToFulfill(accessToken); setIncomingOrders(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshAvailableDeliveries=async()=>{ if(!accessToken) return; try{ const list=await apiGetAvailableOrders(accessToken); setAvailableDeliveries(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshMyDeliveries=async()=>{ if(!accessToken) return; try{ const list=await apiGetMyDeliveries(accessToken); setMyDeliveries(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshWalletBalance=async()=>{ if(!accessToken) return; try{ const w=await apiGetWallet(accessToken); setWallet(Number(w.balance)); }catch(e){} };

  // Reconstitue le format app d'un service reçu du serveur
  const serverToLocalService=(s)=>({ id:s.id, proId:s.proId, name:s.name, price:Number(s.price), domaine:s.domaine, desc:s.description||"", bureau:s.bureau||"Bureau MERCA", dispo:s.dispo, last: s.priceLockedUntil ? new Date(s.priceLockedUntil).getTime()-R.BLOQUE*86400000 : 0 });
  // Reconstitue le format app d'une réservation reçue du serveur (retrouve le
  // service correspondant dans le catalogue de services déjà chargé)
  const serverToLocalBooking=(b)=>{
    const service = services.find(s=>s.id===b.serviceId) || { name:"Service", bureau:"" };
    const stepIndex = BOOKING_STEPS.indexOf(b.status);
    return { id:b.id, bookingCode:b.bookingCode, service, slot:{ label:new Date(b.slotAt).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) }, price:Number(b.price), com:Number(b.commission), total:Number(b.total), status:b.status, step: stepIndex>=0?stepIndex:0, proId:b.proId, clientId:b.clientId };
  };
  const refreshServices=async()=>{ try{ const list=await apiGetServices(); setServices(list.map(serverToLocalService)); }catch(e){} };
  const refreshMyBookings=async()=>{ if(!accessToken) return; try{ const list=await apiGetMyBookings(accessToken); setBookings(list.map(serverToLocalBooking)); }catch(e){} };
  const refreshBookingsToFulfill=async()=>{ if(!accessToken) return; try{ const list=await apiGetBookingsToFulfill(accessToken); setIncomingBookings(list.map(serverToLocalBooking)); }catch(e){} };
  const getLevel=()=>{ if(user?.guest) return "Invité"; if(points>=R.OR){ if(orDate && (Date.now()-orDate)/(30*24*60*60*1000) > R.OR_CYCLE_MOIS) return "ARGENT (Or expiré - 9 mois)"; return "OR"; } if(points>=R.ARGENT) return "ARGENT"; return "BRONZE"; };
  const approx=(a,b)=>{ a=a.toLowerCase(); b=b.toLowerCase(); return b.includes(a)||(a.includes('iphon')&&b.includes('iphone')); };
  const hasRole=(r)=> !!(user && user.roles && user.roles.includes(r));
  const isVerified=(r)=> !!(user && user.verifiedRoles && user.verifiedRoles.includes(r));
  const confirm=(t,m,a)=>Alert.alert(t,m,[{text:"Annuler",style:"cancel"},{text:"Confirmer",style:"destructive",onPress:a}]);
  const requireAccount=(action)=> Alert.alert("Compte requis", `Crée un compte gratuit pour ${action} (SIMULATION TEST - inscription rapide).`, [{text:"Plus tard",style:"cancel"},{text:"S'inscrire",onPress:()=>setUser(null)}]);

  const filteredExact=useMemo(()=>{
    if(debouncedSearch==='') return [];
    if(smartResults && smartResults.length>0) return smartResults;
    return products.filter(p=>approx(debouncedSearch,p.name+" "+p.shop));
  },[products,debouncedSearch,smartResults]);
  const filtered=useMemo(()=>products.filter(p=>(debouncedSearch===''||approx(debouncedSearch,p.name+" "+p.shop))&&(cat==="Tous"||p.cat===cat)&&p.ville===ville&&p.rayon<=rayon),[products,debouncedSearch,cat,ville,rayon]);
  const dispoServices=useMemo(()=>services.filter(s=>s.dispo),[services]);

  const toggleFavorite=(id)=> setFavorites(f=> f.includes(id) ? f.filter(x=>x!==id) : [...f,id]);

  // ---- Partage marketing (Niveau 1 : ouvre le partage natif du téléphone -
  // Facebook, Instagram, WhatsApp, etc. - avec un message professionnel déjà prêt) ----
  const shareService=(s)=>{
    const texte=`🧑‍💼 SERVICE PROFESSIONNEL — MERCA\n\n${s.name}\n💰 À partir de ${money(s.price)}\n🏢 ${user?.bureau||"Bureau professionnel"}\n\n${cleanDesc(s.desc)}\n\n✅ Réservation simple et rapide\n📲 Confirmation immédiate\n🔒 Paiement sécurisé\n\n👉 Réservez votre créneau sur MERCA !\n\n#MERCA #Yaoundé #ServicesPro`;
    Share.share({ message: texte }).catch(()=>{});
  };

  // Cache des notes moyennes, indexé par vrai identifiant de compte (pas par
  // nom de boutique comme avant) - alimenté par le serveur à la demande.
  const [ratingsCache,setRatingsCache]=useState({});
  const getRating=(targetUserId)=> targetUserId ? ratingsCache[targetUserId] : null;
  const loadRating=async(targetUserId)=>{
    if(!targetUserId || ratingsCache[targetUserId]!==undefined) return;
    try{ const r=await apiGetReviewsForTarget(targetUserId); setRatingsCache(c=>({...c,[targetUserId]: r.avg?{avg:r.avg,count:r.count}:null})); }
    catch(e){ setRatingsCache(c=>({...c,[targetUserId]:null})); }
  };

  // ---- Partage marketing gratuit (ouvre Facebook, Instagram, WhatsApp... déjà installés sur le téléphone) ----
  // ---- Partage marketing gratuit (ouvre Facebook, Instagram, WhatsApp... déjà installés sur le téléphone) ----
  const shareProduct=async(p)=>{
    try{
      const desc=cleanDesc(p.desc);
      await Share.share({
        message: `🛍️ NOUVEAU SUR MERCA\n\n${p.name}\n💰 ${money(p.price)}\n📍 Disponible à ${p.ville||"Yaoundé"}\n${desc?`\n${desc}\n`:""}\n✅ Prix vérifié et garanti\n📦 Commande directe et sécurisée\n🚚 Livraison rapide\n\n👉 Commandez dès maintenant sur MERCA !\n\n#MERCA #Yaoundé #ShoppingCameroun`,
      });
    }catch(e){ /* utilisateur a annulé le partage, rien à faire */ }
  };

  // ---- Inscription / connexion réelle (étape 1 : demander le code) ----
  const startOtp=async()=>{
    if(authMode==="register" && !regName.trim()) return Alert.alert("Erreur","Le nom est requis");
    if(!regPhone.trim() || regPhone.trim().replace(/\D/g,"").length<6) return Alert.alert("Erreur","Numéro de téléphone invalide");
    if(authMode==="register" && regRole && !regExtra.trim()) return Alert.alert("Erreur", `Le champ "${ROLES_INFO[regRole].champ}" est requis`);
    setAuthError(""); setAuthLoading(true);
    try{
      const r = await apiRequestOtp(normalizePhone(regPhone));
      if(r && r.devCode) setOtpCode(r.devCode); // phase de test : code auto-rempli, pas de vrai SMS envoyé
      setOtpStep("code");
    }catch(e){ setAuthError(e.message); }
    setAuthLoading(false);
  };

  // ---- Inscription / connexion réelle (étape 2 : vérifier le code reçu) ----
  const confirmOtp=async()=>{
    if(!otpCode.trim() || otpCode.trim().length!==6) return Alert.alert("Erreur","Entre le code à 6 chiffres reçu par SMS");
    setAuthError(""); setAuthLoading(true);
    try{
      const { accessToken:token, user:serverUser } = await apiVerifyOtp(normalizePhone(regPhone), otpCode.trim(), authMode==="register"?regReferralCode.trim():undefined);
      setAccessToken(token);
      SecureStore.setItemAsync("merca_access_token", token).catch(()=>{}); // stockage chiffré
      registerPushToken(token); // en arrière-plan, ne bloque rien

      let updated=serverUser;
      let balance=0;

      if(authMode==="register"){
        // Complète le profil côté serveur (le serveur ne connaissait que le numéro jusqu'ici)
        try{ updated = await apiUpdateProfile(token, { name:regName.trim(), city:regCity }); }catch(e){}

        // Active le rôle choisi (commerçant / livreur / employé pro) côté serveur
        if(regRole){
          const extra={};
          if(regRole==="commercant") extra.shopName=regExtra.trim();
          if(regRole==="livreur") extra.vehicule=regExtra.trim();
          if(regRole==="pro"){ extra.bureau=regExtra.trim(); extra.domaine=regDomaine; }
          try{ updated = await apiAddRole(token, { role:regRole, ...extra }); }catch(e){}
        }
        setPoints(p=>{
          if(regRole==="livreur") return R.POINTS_INSCRIPTION+R.POINTS_LIVREUR_ACTIVATION;
          if(regRole==="commercant"||regRole==="pro") return R.POINTS_INSCRIPTION+R.POINTS_PRO_ACTIVATION;
          return R.POINTS_INSCRIPTION;
        });
      }
      // En mode "Se connecter" : on garde le profil déjà existant tel quel côté
      // serveur (nom, ville, rôles) - on ne réécrit rien par-dessus.

      try{ const w=await apiGetWallet(token); balance=Number(w.balance); }catch(e){}

      const newUserObj = { id:updated.id, name:updated.name||regName.trim(), phone:updated.phone, city:updated.city||regCity, roles:updated.roles||["client"], verifiedRoles:updated.verifiedRoles||[], avatarUri:null, guest:false, createdAt:Date.now(), shopName:updated.shopName, vehicule:updated.vehicule, bureau:updated.bureau, domaine:updated.domaine, isAdmin:!!updated.isAdmin };
      setUser(newUserObj);
      setWallet(balance);
      setWalletHistory(h=> h.length?h:[{id:"h0",type:"Portefeuille (solde réel du serveur)",amount:balance,icon:"🧪",color:"#888"}]);
      setRegName(""); setRegPhone(""); setRegExtra(""); setRegRole(null); setRegReferralCode(""); setOtpCode(""); setOtpStep("form");
      // Multi-comptes : garde ce compte dans la liste pour pouvoir y revenir sans se reconnecter
      const updatedList = await upsertSavedAccountInList({ phone:newUserObj.phone, accessToken:token, user:newUserObj });
      setSavedAccounts(updatedList);
    }catch(e){ setAuthError(e.message); }
    setAuthLoading(false);
  };

  const backToAuthForm=()=>{ setOtpStep("form"); setOtpCode(""); setAuthError(""); };

  // ---- Continuer sans compte (accès limité) ----
  const continueAsGuest=()=>{
    setUser({ id:"guest", name:"Invité", phone:"", city:regCity||"Yaoundé", roles:["client"], verifiedRoles:[], avatarUri:null, guest:true, createdAt:Date.now() });
    setPoints(0); setWallet(0); setWalletHistory([]);
  };

  const confirmAddRole=async()=>{
    if(!roleModal || !accessToken) return;
    if(!roleExtra.trim()) return Alert.alert("Erreur", `Le champ "${ROLES_INFO[roleModal].champ}" est requis`);
    const extra={};
    if(roleModal==="commercant") extra.shopName=roleExtra.trim();
    if(roleModal==="livreur") extra.vehicule=roleExtra.trim();
    if(roleModal==="pro"){ extra.bureau=roleExtra.trim(); extra.domaine=roleDomaine; }
    try{
      const updated = await apiAddRole(accessToken, { role:roleModal, ...extra });
      setUser(u=>({ ...u, roles:updated.roles||[...new Set([...u.roles, roleModal])], ...extra }));
      if(roleModal==="livreur") setPoints(p=>p+R.POINTS_LIVREUR_ACTIVATION); // bonus unique à l'activation du rôle livreur
      if(roleModal==="commercant"||roleModal==="pro") setPoints(p=>p+R.POINTS_PRO_ACTIVATION); // bonus unique à l'activation du rôle commerçant/pro
      setRoleModal(null); setRoleExtra("");
      Alert.alert("Rôle activé", `Espace ${ROLES_INFO[roleModal].label} disponible`);
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  const openAccountEdit=()=>{ setAccName(user.name); setAccPhone(user.phone); setAccCity(user.city); setShowAccountEdit(true); };
  const saveAccountEdit=()=>{
    if(!accName.trim()) return Alert.alert("Erreur","Le nom est requis");
    if(!accPhone.trim() || accPhone.trim().length<8) return Alert.alert("Erreur","Numéro invalide");
    setUser(u=>({...u, name:accName.trim(), phone:accPhone.trim(), city:accCity}));
    setShowAccountEdit(false);
  };

  const savePinChange=async()=>{
    if(!/^\d{4}$/.test(newPin)) return Alert.alert("Erreur","Le PIN doit contenir exactement 4 chiffres");
    if(newPin!==newPinConfirm) return Alert.alert("Erreur","Les deux codes PIN ne correspondent pas");
    setWalletPin(await hashPin(newPin)); setNewPin(""); setNewPinConfirm(""); setShowPinChange(false);
    Alert.alert("PIN mis à jour","SIMULATION TEST");
  };

  const logout=()=> confirm("Déconnexion","Tu devras te reconnecter pour revenir. Tes données restent enregistrées sur cet appareil.",()=>{
    SecureStore.deleteItemAsync("merca_access_token").catch(()=>{});
    setAccessToken(null); setUser(null); home();
  });
  const resetAllData=()=> confirm("Réinitialiser toutes les données","Cette action efface tout - SIMULATION TEST. Irréversible.",async()=>{
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync("merca_access_token").catch(()=>{});
    setUser(null); setAccessToken(null); setProducts(INITIAL_PRODUCTS); setServices([]); setOrders([]); setBookings([]); setWallet(0); setPoints(0); setOrDate(null);
    setWalletHistory([]); setWalletPin(await hashPin("1234")); setFavorites([]); setDark(false); setNotifEnabled(true); setReviews([]); setMessages([]); setDisputes([]); home();
  });

  // ---- Multi-comptes : basculer / ajouter / retirer un compte ----
  const switchToAccount=(account)=>{
    setAccessToken(account.accessToken);
    SecureStore.setItemAsync("merca_access_token", account.accessToken).catch(()=>{});
    setUser(account.user);
    // Recharge le solde réel du portefeuille pour ce compte (peut avoir changé depuis)
    apiGetWallet(account.accessToken).then(w=>setWallet(Number(w.balance))).catch(()=>{});
    setShowAccountSwitcher(false);
    home();
  };
  const addAnotherAccount=()=>{
    // Le compte actif reste dans la liste (déjà sauvegardé) - on affiche juste
    // l'écran de connexion/inscription pour en ajouter un nouveau.
    setShowAccountSwitcher(false);
    setAccessToken(null);
    setUser(null);
  };
  const removeSavedAccount=(phone)=> confirm("Retirer ce compte","Il ne sera plus proposé dans la liste de bascule rapide - tu devras te reconnecter avec le code SMS pour le récupérer.",async()=>{
    const updatedList = await removeSavedAccountFromList(phone);
    setSavedAccounts(updatedList);
    if(user?.phone===phone){
      SecureStore.deleteItemAsync("merca_access_token").catch(()=>{});
      setAccessToken(null); setUser(null); home();
    }
  });

  // ---- Photo de profil (avatar) ----
  const pickAvatar=async()=>{
    // Sur l'aperçu WEB d'Expo Snack, l'accès aux photos du téléphone n'est
    // pas toujours disponible (c'est une limite de l'aperçu web, pas de ce
    // code) — teste cette fonction via le QR code / l'app Expo Go sur un
    // vrai téléphone pour qu'elle fonctionne. Le try/catch évite un plantage
    // de toute l'app si le module n'est pas disponible dans l'environnement.
    try{
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!perm.granted) return Alert.alert("Permission refusée","Autorise l'accès à tes photos pour choisir un avatar.");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.7 });
      if(!result.canceled && result.assets && result.assets[0]) {
        setUser(u=>({...u, avatarUri: result.assets[0].uri}));
      }
    }catch(e){
      Alert.alert("Photo indisponible ici","Sur l'aperçu web de Snack, essaie plutôt via le QR code sur ton téléphone.");
    }
  };

  // ---- Commandes produit (identique V5, avec vérification invité) ----
  const createOrder=async(product,delivery)=>{
    if(user.guest) return requireAccount("passer une commande");
    if(!accessToken) return Alert.alert("Erreur","Reconnecte-toi (session expirée).");
    if(Date.now()<blocked) return Alert.alert("SIMULATION TEST","Compte bloqué temporairement");
    if(!product.merchantId) return Alert.alert("Produit de démonstration","Ce produit n'existe pas vraiment sur le serveur - choisis un produit ajouté par un vrai commerçant pour passer une vraie commande.");
    if(orderSubmitting) return; // une commande est déjà en cours d'envoi, on ignore ce deuxième appui
    const isDelivery = delivery==="Livraison MERCA";
    const com=Math.round(product.price*R.FRAIS_PRODUIT);
    const tot=product.price + (isDelivery? R.BASE + com : 0);
    if(wallet<tot) return Alert.alert("Solde insuffisant","");
    if(product.stock<=0) return Alert.alert("Rupture de stock","");
    setOrderSubmitting(true);
    try{
      const created = await apiCreateOrder(accessToken, { productId:product.id, merchantId:product.merchantId, productPrice:product.price, delivery:isDelivery, idempotencyKey:uid("idem") });
      const o = serverToLocalOrder(created);
      setOrders(os=>[o,...os]);
      setProducts(ps=>ps.map(p=>p.id===product.id?{...p,stock:Math.max(0,p.stock-1)}:p));
      setSelectedOrder(o);
      await refreshWalletBalance();
      setWalletHistory(h=>[{id:uid("h"),type:`${product.name} - Code ${o.codeLivraison}`,amount:-o.total,icon:"📦",color:"#111"},...h]);
      nav("tracking");
    }catch(e){ Alert.alert("Erreur", e.message); }
    finally{ setOrderSubmitting(false); }
  };

  // Fait avancer une commande d'une étape (appelé depuis l'écran du
  // commerçant ou du livreur, selon l'étape - le serveur vérifie les droits)
  const doAdvance=async(order, onDone)=>{
    if(!accessToken) return;
    try{
      await apiAdvanceOrder(accessToken, order.id);
      if(onDone) await onDone();
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  const confirmReception=(order)=>{
    confirm(`Confirmer réception - Code ${order.codeLivraison}`,`Débloque les fonds vers le commerçant/livreur - +${R.POINTS_PAR_LIVRAISON} pts`,async()=>{
      if(!accessToken) return;
      try{
        const updated = await apiConfirmOrder(accessToken, order.id);
        const u = serverToLocalOrder(updated);
        setOrders(os=>os.map(o=>o.id===order.id?u:o)); setSelectedOrder(u);
        setPoints(p=>{ const np=p+R.POINTS_PAR_LIVRAISON; if(np>=R.OR && !orDate) setOrDate(Date.now()); return np; });
        Alert.alert("Confirmé !",`+${R.POINTS_PAR_LIVRAISON} pts - Code ${order.codeLivraison}`);
        nav("home");
      }catch(e){ Alert.alert("Erreur", e.message); }
    });
  };

  const createProd=async()=>{
    const priceNum=parseFloat(npPrice); const stockNum=parseInt(npStock,10);
    if(!npName.trim()) return Alert.alert("Erreur","Nom du produit requis");
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Prix invalide");
    if(isNaN(stockNum) || stockNum<0) return Alert.alert("Erreur","Stock invalide");
    if(!accessToken){ return Alert.alert("Erreur","Reconnecte-toi pour ajouter un produit (session expirée)."); }
    try{
      const created = await apiCreateProduct(accessToken, { name:npName.trim(), price:priceNum, stock:stockNum, category:npCat, city:user.city||"Yaoundé", shopName:user.shopName });
      setProducts(ps=>[serverToLocalProduct(created), ...ps]);
      setShowAdd(false); setNpName(""); setNpPrice(""); setNpStock("1");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };
  const openEdit=(p)=>{ setShowEdit(p); setEditPrice(String(p.price)); setEditStock(String(p.stock)); };
  const updateProd=async()=>{
    if(!showEdit) return;
    const locked = Date.now()-showEdit.last < R.BLOQUE*86400000;
    if(locked){ const j=Math.ceil((R.BLOQUE*86400000-(Date.now()-showEdit.last))/86400000); return Alert.alert(`Bloqué encore ${j}j`,`Le prix ne peut pas changer avant ${j} jour(s).`); }
    const priceNum=parseFloat(editPrice); const stockNum=parseInt(editStock,10);
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Prix invalide");
    if(isNaN(stockNum) || stockNum<0) return Alert.alert("Erreur","Stock invalide");
    confirm(`Modifier - bloqué ${R.BLOQUE}j après ce changement`, `Nouveau prix ${money(priceNum)} ?`, async()=>{
      if(showEdit.merchantId && accessToken){
        try{
          const updated = await apiUpdateProduct(accessToken, showEdit.id, { price:priceNum, stock:stockNum });
          setProducts(ps=>ps.map(pr=>pr.id===showEdit.id?serverToLocalProduct(updated):pr));
        }catch(e){ Alert.alert("Erreur", e.message); return; }
      }else{
        setProducts(ps=>ps.map(pr=>pr.id===showEdit.id?{...pr,price:priceNum,stock:stockNum,last:Date.now()}:pr));
      }
      setShowEdit(null);
    });
  };

  const createService=async()=>{
    const priceNum=parseFloat(nsPrice);
    if(!nsName.trim()) return Alert.alert("Erreur","Nom du service requis");
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Tarif invalide");
    if(!accessToken) return Alert.alert("Erreur","Reconnecte-toi (session expirée).");
    try{
      const created = await apiCreateService(accessToken, { name:nsName.trim(), price:priceNum, domaine:nsDomaine, description:nsDesc.trim(), bureau:user.bureau });
      setServices(ss=>[serverToLocalService(created), ...ss]);
      setShowAddService(false); setNsName(""); setNsPrice(""); setNsDesc("");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };
  const openEditService=(s)=>{ setShowEditService(s); setEsPrice(String(s.price)); };
  const updateService=()=>{
    if(!showEditService) return;
    const locked = Date.now()-showEditService.last < R.BLOQUE*86400000;
    if(locked){ const j=Math.ceil((R.BLOQUE*86400000-(Date.now()-showEditService.last))/86400000); return Alert.alert(`Bloqué encore ${j}j`,`Le tarif ne peut pas changer avant ${j} jour(s).`); }
    const priceNum=parseFloat(esPrice);
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Tarif invalide");
    confirm(`Modifier - bloqué ${R.BLOQUE}j`, `Nouveau tarif ${money(priceNum)} ?`, async()=>{
      try{
        const updated = await apiUpdateService(accessToken, showEditService.id, { price:priceNum });
        setServices(ss=>ss.map(s=>s.id===showEditService.id?serverToLocalService(updated):s));
      }catch(e){ Alert.alert("Erreur", e.message); return; }
      setShowEditService(null);
    });
  };
  const toggleDispo=async(id)=>{
    const s=services.find(x=>x.id===id); if(!s || !accessToken) return;
    try{
      const updated = await apiUpdateService(accessToken, id, { dispo: !s.dispo });
      setServices(ss=>ss.map(x=>x.id===id?serverToLocalService(updated):x));
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  // ---- Réservation de service ----
  const createBooking=async()=>{
    if(user.guest) return requireAccount("réserver un service");
    if(!selectedService || !selectedSlot || !accessToken) return;
    if(bookingSubmitting) return; // une réservation est déjà en cours d'envoi, on ignore ce deuxième appui
    const com=Math.round(selectedService.price*R.FRAIS_SERVICE); const tot=selectedService.price+com;
    if(wallet<tot) return Alert.alert("Solde insuffisant","");
    setBookingSubmitting(true);
    try{
      const created = await apiCreateBooking(accessToken, { serviceId:selectedService.id, proId:selectedService.proId, servicePrice:selectedService.price, slotAt:new Date(selectedSlot.at).toISOString(), idempotencyKey:uid("idem") });
      const b = serverToLocalBooking(created);
      setBookings(bs=>[b,...bs]);
      await refreshWalletBalance();
      setWalletHistory(h=>[{id:uid("h"),type:`Réservation ${selectedService.name} - Code ${b.bookingCode}`,amount:-b.total,icon:"📅",color:"#111"},...h]);
      setSelectedBooking(b); setSelectedSlot(null); nav("bookingTracking");
    }catch(e){ Alert.alert("Erreur", e.message); }
    finally{ setBookingSubmitting(false); }
  };
  const proConfirmBooking=async(b)=>{
    try{ const updated=await apiConfirmBooking(accessToken, b.id); setBookings(bs=>bs.map(x=>x.id===b.id?serverToLocalBooking(updated):x)); setIncomingBookings(bs=>bs.map(x=>x.id===b.id?serverToLocalBooking(updated):x)); }
    catch(e){ Alert.alert("Erreur", e.message); }
  };
  const proCompleteBooking=(b)=>{
    confirm("Marquer terminé", `Débloque ${money(b.total)} pour ton bureau - Code ${b.bookingCode}`, async()=>{
      try{
        const updated=await apiCompleteBooking(accessToken, b.id);
        setBookings(bs=>bs.map(x=>x.id===b.id?serverToLocalBooking(updated):x));
        setIncomingBookings(bs=>bs.map(x=>x.id===b.id?serverToLocalBooking(updated):x));
      }catch(e){ Alert.alert("Erreur", e.message); }
    });
  };
  const cancelBooking=(b)=>{
    confirm("Annuler la réservation", "Le montant sera remboursé", async()=>{
      try{
        await apiCancelBooking(accessToken, b.id);
        setBookings(bs=>bs.filter(x=>x.id!==b.id));
        await refreshWalletBalance();
        setWalletHistory(h=>[{id:uid("h"),type:`Remboursement réservation annulée - Code ${b.bookingCode}`,amount:b.total,icon:"↩️",color:"#00a651"},...h]);
        nav("home");
      }catch(e){ Alert.alert("Erreur", e.message); }
    });
  };

  // ---- Avis ----
  const openReview=(targetUserId, refOrderId, refBookingId)=>{ setReviewModal({targetUserId, refOrderId, refBookingId}); setReviewRating(5); setReviewComment(""); };
  const submitReview=async()=>{
    if(!reviewModal || !accessToken) return;
    try{
      await apiCreateReview(accessToken, { targetUserId:reviewModal.targetUserId, rating:reviewRating, comment:reviewComment.trim()||undefined, refOrderId:reviewModal.refOrderId, refBookingId:reviewModal.refBookingId });
      setRatingsCache(c=>{ const n={...c}; delete n[reviewModal.targetUserId]; return n; }); // force un rechargement de la note à jour
      setReviewModal(null);
      Alert.alert("Merci !","Ton avis a été enregistré");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  // ---- Support réel (messages + litige), branché sur le serveur ----
  const [supportLoading,setSupportLoading]=useState(false);
  // Transforme un message serveur ({id, threadId, senderId, body, createdAt})
  // vers le format utilisé par l'affichage ({id, threadId, from, text, at}).
  const serverMsgToLocal=(m)=>({ id:m.id, threadId:m.threadId, from: m.senderId===user?.id ? "client" : "vendor", text:m.body, at:new Date(m.createdAt).getTime() });
  const serverDisputeToLocal=(d)=>({ id:d.id, threadId:d.threadId, reason:d.reason, description:d.description, status:d.status, createdAt:new Date(d.createdAt).getTime() });
  const loadSupportThread=async(threadId)=>{
    if(!threadId || !accessToken) return;
    setSupportLoading(true);
    try{
      const [msgs, disps] = await Promise.all([ apiGetMessages(accessToken, threadId), apiGetThreadDisputes(accessToken, threadId) ]);
      setMessages(ms=> [ ...ms.filter(m=>m.threadId!==threadId), ...msgs.map(serverMsgToLocal) ]);
      setDisputes(ds=> [ ...ds.filter(d=>d.threadId!==threadId), ...disps.map(serverDisputeToLocal) ]);
    }catch(e){ Alert.alert("Erreur", e.message); }
    finally{ setSupportLoading(false); }
  };
  useEffect(()=>{
    if(page==="support" && supportThread) loadSupportThread(supportThread);
  },[page, supportThread]);
  const threadMessages=(threadId)=> messages.filter(m=>m.threadId===threadId);
  const sendMessage=async()=>{
    if(!messageInput.trim() || !supportThread || !accessToken) return;
    const text=messageInput.trim();
    setMessageInput("");
    try{
      await apiSendMessage(accessToken, supportThread, text);
      await loadSupportThread(supportThread);
    }catch(e){ Alert.alert("Erreur", e.message); setMessageInput(text); }
  };
  const submitDispute=async()=>{
    if(!disputeDesc.trim()) return Alert.alert("Erreur","Décris le problème");
    if(!supportThread || !accessToken) return;
    try{
      await apiCreateDispute(accessToken, supportThread, disputeReason, disputeDesc.trim());
      setShowDisputeForm(false); setDisputeDesc("");
      await loadSupportThread(supportThread);
      Alert.alert("Réclamation envoyée","Ton signalement a bien été transmis. Tu seras notifié de son avancement.");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  // ---- KYC ----
  const submitKyc=()=>{
    if(!kycModal) return;
    if(!kycDoc.trim()) return Alert.alert("Erreur","Numéro de pièce d'identité requis");
    setUser(u=>({...u, verifiedRoles:[...new Set([...(u.verifiedRoles||[]), kycModal])]}));
    setKycModal(null); setKycDoc("");
    Alert.alert("Vérifié","SIMULATION TEST - dans une vraie version, un humain ou un service tiers doit contrôler le document avant validation.");
  };

  // (la prise de livraison se fait maintenant via doAdvance, voir écran "courier" plus bas)

  const T = dark
    ? { bg:"#121417", card:"#1D2024", text:"#F3F4F6", sub:"rgba(243,244,246,0.6)", header:"#1D2024" }
    : { bg:"#F6F7F9", card:"#FFFFFF", text:"#111111", sub:"rgba(17,17,17,0.6)", header:"#FFFFFF" };

  if(!ready){
    return <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}><View style={styles.empty5D}><Text>Chargement MERCA...</Text></View></SafeAreaView>;
  }

  // ================= ÉCRAN D'ACCUEIL (inscription OU invité) =================
  if(!user){
    return (
      <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{flexDirection:"row",justifyContent:"flex-end",marginBottom:8}}>
            <TouchableOpacity onPress={()=>setShowLangPicker(true)} style={{backgroundColor:T.card,borderRadius:20,paddingHorizontal:14,paddingVertical:6}}>
              <Text style={{color:T.text,fontWeight:"700"}}>{(LANGUAGES.find(l=>l.code===lang)||LANGUAGES[0]).flag} {lang.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
          <Modal visible={showLangPicker} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
            <Text style={styles.modalTitle5D}>🌐 {t("lang_label")}</Text>
            <ScrollView style={{maxHeight:360}}>
              {LANGUAGES.map(l=>(
                <TouchableOpacity key={l.code} onPress={()=>{ setLang(l.code); setShowLangPicker(false); }} style={{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#F1F3F5"}}>
                  <Text style={{fontSize:16,flex:1}}>{l.flag}  {l.label}</Text>
                  {lang===l.code && <Text style={{fontSize:16}}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowLangPicker(false)}><Text style={styles.secondary5DT}>Fermer</Text></TouchableOpacity>
          </View></View></Modal>
          <Banner color={BANNERS.auth.color} icon={BANNERS.auth.icon} style={styles.hero5D} radius={24}>
            <View style={styles.hero5DOverlay}><Text style={styles.hero5DTitle}>{t("welcome_title")}</Text><Text style={styles.hero5DSub}>{t("welcome_sub")}</Text></View>
          </Banner>

          {otpStep==="form" && (
          <View style={{flexDirection:"row",marginTop:16,marginBottom:8,backgroundColor:T.card,borderRadius:14,padding:4}}>
            <TouchableOpacity onPress={()=>setAuthMode("login")} style={{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:authMode==="login"?BRAND:"transparent"}}>
              <Text style={{textAlign:"center",fontWeight:"700",color:authMode==="login"?"#fff":T.text}}>{lang==="fr"?"Se connecter":"Log in"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setAuthMode("register")} style={{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:authMode==="register"?BRAND:"transparent"}}>
              <Text style={{textAlign:"center",fontWeight:"700",color:authMode==="register"?"#fff":T.text}}>{lang==="fr"?"Créer un compte":"Create account"}</Text>
            </TouchableOpacity>
          </View>
          )}

          {otpStep==="form" && (
          <TouchableOpacity style={styles.guestBtn5D} onPress={continueAsGuest}>
            <Text style={styles.guestBtn5DT}>{t("guest_btn")}</Text>
          </TouchableOpacity>
          )}
          {otpStep==="form" && <Text style={styles.ruleD5D}>{t("guest_note")}</Text>}

          {otpStep==="form" ? (
          <>
          {authMode==="login" ? (
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>{lang==="fr"?"Retrouve ton compte":"Find your account"}</Text>
            <View style={{flexDirection:"row",gap:8,alignItems:"center"}}>
              <TouchableOpacity onPress={()=>setShowCountryPicker(true)} style={[styles.input5D,{flexDirection:"row",alignItems:"center",gap:4,flex:0,paddingHorizontal:12}]}>
                <Text style={{fontSize:18}}>{COUNTRY_CODES.find(c=>c.code===regCountryCode)?.flag || "🌍"}</Text>
                <Text style={{fontWeight:"700",color:T.text}}>{regCountryCode}</Text>
              </TouchableOpacity>
              <TextInput value={regPhone} onChangeText={setRegPhone} placeholder={t("phone_placeholder")} keyboardType="phone-pad" style={[styles.input5D,{flex:1}]}/>
            </View>
          </View>
          ) : (
          <>
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("create_account_title")}</Text>
            <TextInput value={regName} onChangeText={setRegName} placeholder={t("name_placeholder")} style={styles.input5D}/>
            <View style={{flexDirection:"row",gap:8,alignItems:"center"}}>
              <TouchableOpacity onPress={()=>setShowCountryPicker(true)} style={[styles.input5D,{flexDirection:"row",alignItems:"center",gap:4,flex:0,paddingHorizontal:12}]}>
                <Text style={{fontSize:18}}>{COUNTRY_CODES.find(c=>c.code===regCountryCode)?.flag || "🌍"}</Text>
                <Text style={{fontWeight:"700",color:T.text}}>{regCountryCode}</Text>
              </TouchableOpacity>
              <TextInput value={regPhone} onChangeText={setRegPhone} placeholder={t("phone_placeholder")} keyboardType="phone-pad" style={[styles.input5D,{flex:1}]}/>
            </View>
            <TextInput value={regCity} onChangeText={setRegCity} placeholder={t("city_placeholder")} style={styles.input5D}/>
            <TextInput value={regReferralCode} onChangeText={(v)=>{ setRegReferralCode(v); setReferralAutoFilled(false); }} placeholder={lang==="fr"?"Code de parrainage (facultatif)":"Referral code (optional)"} autoCapitalize="characters" style={styles.input5D}/>
            {referralAutoFilled && <Text style={{fontSize:11,color:"#00a651",marginTop:4,fontWeight:"700"}}>{lang==="fr"?"✅ Code détecté automatiquement":"✅ Code auto-detected"}</Text>}
          </View>

          <Modal visible={showCountryPicker} transparent animationType="slide" onRequestClose={()=>setShowCountryPicker(false)}>
            <View style={styles.modalBg5D}>
              <View style={[styles.modal5D,{maxHeight:"75%"}]}>
                <Text style={styles.modalTitle5D}>{lang==="fr"?"Choisis ton pays":"Choose your country"}</Text>
                <TextInput value={countrySearch} onChangeText={setCountrySearch} placeholder={lang==="fr"?"Rechercher un pays...":"Search a country..."} style={[styles.input5D,{marginTop:0}]}/>
                <ScrollView style={{marginTop:8}}>
                  {COUNTRY_CODES.filter(c=>c.country.toLowerCase().includes(countrySearch.trim().toLowerCase()) || c.code.includes(countrySearch.trim())).map(c=>(
                    <TouchableOpacity key={c.country+c.code} style={{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#eee"}} onPress={()=>{ setRegCountryCode(c.code); setShowCountryPicker(false); setCountrySearch(""); }}>
                      <Text style={{fontSize:20}}>{c.flag}</Text>
                      <Text style={{flex:1,color:T.text}}>{c.country}</Text>
                      <Text style={{fontWeight:"700",color:T.text}}>{c.code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setShowCountryPicker(false); setCountrySearch(""); }}><Text>{lang==="fr"?"Fermer":"Close"}</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={[styles.section5D,{color:T.text}]}>{t("how_use_title")}</Text>
          <RoleCard active={regRole===null} icon={ROLES_INFO.client.icon} color={ROLES_INFO.client.color} label={t("client_only_label")} desc={t("client_only_desc")} onPress={()=>setRegRole(null)}/>
          {["commercant","livreur","pro"].map(key=>(
            <RoleCard key={key} active={regRole===key} icon={ROLES_INFO[key].icon} color={ROLES_INFO[key].color} label={ROLES_INFO[key].label} desc={ROLES_INFO[key].desc} onPress={()=>setRegRole(key)}/>
          ))}

          {regRole && (
            <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
              <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("details_title")} {ROLES_INFO[regRole].label}</Text>
              <TextInput value={regExtra} onChangeText={setRegExtra} placeholder={ROLES_INFO[regRole].champ} style={styles.input5D}/>
              {regRole==="pro" && (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,regDomaine===d&&styles.cat5DActive]} onPress={()=>setRegDomaine(d)}><Text style={regDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>)}
            </View>
          )}
          </>
          )}

          {!!authError && <Text style={{color:"#e74c3c",marginTop:8,textAlign:"center"}}>{authError}</Text>}
          <TouchableOpacity style={styles.buy5D} onPress={startOtp} disabled={authLoading}>
            <Text style={styles.buy5DT}>{authLoading ? t("sending_code") : t("receive_code_btn")}</Text>
          </TouchableOpacity>
          </>
          ) : (
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("code_sent_title")} {regPhone}</Text>
            <Text style={styles.ruleD5D}>{t("code_sim_note")}</Text>
            <TextInput value={otpCode} onChangeText={setOtpCode} placeholder={t("code_placeholder")} keyboardType="number-pad" maxLength={6} style={styles.input5D}/>
            {!!authError && <Text style={{color:"#e74c3c",marginTop:8,textAlign:"center"}}>{authError}</Text>}
            <TouchableOpacity style={styles.buy5D} onPress={confirmOtp} disabled={authLoading}>
              <Text style={styles.buy5DT}>{authLoading ? t("verifying") : (authMode==="register" ? `${t("validate_btn")} (+${R.POINTS_INSCRIPTION} ${t("welcome_pts")})` : t("validate_btn"))}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={backToAuthForm} style={{marginTop:10,alignSelf:"center"}}>
              <Text style={{color:T.text,opacity:0.7}}>{t("edit_info_link")}</Text>
            </TouchableOpacity>
          </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ================= HOME =================
  if(page==="home"){
    const ListHeader = (
      <View>
        <View style={[styles.header5D,{backgroundColor:T.card}]}>
          <View style={styles.headerLeft}>
            <Avatar user={user} size={44}/>
            <View><Text style={[styles.logo5D,{color:T.text}]}>MERCA</Text><Text style={styles.logoSub5D}>{user.guest?t("home_guest_mode"):`${t("home_hello")} ${user.name.split(" ")[0]}`} • {getLevel()} {!user.guest&&`${points}pts`}</Text></View>
          </View>
          <TouchableOpacity style={styles.badge5D} onPress={()=>nav("settings")}><Text style={styles.badge5DT}>⚙️</Text></TouchableOpacity>
        </View>
        <Banner color={BANNERS.home.color} icon={BANNERS.home.icon} style={styles.hero5D} radius={24}>
          <View style={styles.hero5DOverlay}>
            <Text style={styles.hero5DTitle}>{t("home_hero_title")}</Text>
            <Text style={styles.hero5DSub}>{t("tag_simulation")} - {R.SPLIT_LIVREUR}/{R.SPLIT_MARCHAND}/{R.SPLIT_MERCA}</Text>
            <View style={styles.search5D}><Text>🔎</Text><TextInput value={search} onChangeText={(t)=>{ setSearch(t); setShowAlternatives(false); }} placeholder={t("search_placeholder_exact")} placeholderTextColor="#999" style={styles.searchInput5D}/></View>
          </View>
        </Banner>
        {debouncedSearch!=='' && filteredExact.length>0 && !showAlternatives && (
          <View style={[styles.exactResult5D,{backgroundColor:T.card}]}>
            <Text style={styles.exactTitle}>✅ {t("found_product_title")}</Text>
            {filteredExact.slice(0,1).map(p=>{ const com=Math.round(p.price*R.FRAIS_PRODUIT); return (
              <View key={p.id} style={styles.exactCard5D}><Image source={{uri:p.img}} style={styles.exactImg}/><View style={{flex:1}}><Text style={styles.exactName}>{p.name}</Text><Text style={styles.exactPrice}>{money(p.price)} {t("product_price_real")}</Text><Text style={styles.exactDetail}>{t("tag_product")} {money(p.price)} + 2% {money(com)} + {t("tag_delivery")} {R.BASE}F</Text></View></View>
            );})}
            <View style={{flexDirection:'row',gap:8,marginTop:10}}>
              <TouchableOpacity style={styles.btnPrimary5D} onPress={()=>{ setSelected(filteredExact[0]); nav("product"); }}><Text style={styles.btnPrimary5DT}>{t("btn_view_product")}</Text></TouchableOpacity>
              {!user.guest && <TouchableOpacity style={styles.btnSecondary5D} onPress={()=>setShowAlternatives(true)}><Text style={styles.btnSecondary5DT}>{t("btn_alternatives")}</Text></TouchableOpacity>}
            </View>
          </View>
        )}
        {user.guest && debouncedSearch==='' && (
          <View style={styles.security5D}><Text style={styles.securityText5D}>🔒 {t("guest_catalog_hint")}</Text></View>
        )}
        {!user.guest && (debouncedSearch==='' || showAlternatives) && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:12}}>{CATS.map(c=><TouchableOpacity key={c} style={[styles.cat5D,cat===c&&styles.cat5DActive]} onPress={()=>setCat(c)}><Text style={cat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={[styles.section5D,{color:T.text}]}>{t("catalog_title")}</Text>
          </>
        )}
      </View>
    );
    const ListFooter = (
      <View>
        <TouchableOpacity style={styles.serviceBanner5D} onPress={()=>nav("services")}>
          <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧑‍💼 {t("services_pro_title")}</Text><Text style={styles.gridSub5D}>{t("services_pro_sub")}</Text></View></Banner>
        </TouchableOpacity>
        <View style={styles.grid5D}>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("client")}><Banner color={BANNERS.client.color} icon={BANNERS.client.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>👤 {t("home_client_label")}</Text><Text style={styles.gridSub5D}>{user.guest?t("home_guest_label"):`${points}pts`}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("espaces")}><Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧰 {t("home_space_label")}</Text><Text style={styles.gridSub5D}>{t("home_space_sub")}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>user.guest?requireAccount("accéder à PERMUTA"):nav("permuta")}><Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🔄 {t("home_permuta_label")} {user.guest?"🔒":""}</Text><Text style={styles.gridSub5D}>{t("home_permuta_sub")}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>user.guest?requireAccount("accéder à MERCA CERCLE"):nav("circle")}><Banner color="#F5A623" icon="🎁" style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🎁 {t("home_circle_label")} {user.guest?"🔒":""}</Text><Text style={styles.gridSub5D}>{t("home_circle_sub")}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("settings")}><Banner color={BANNERS.settings.color} icon={BANNERS.settings.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>⚙️ {t("home_settings_label")}</Text><Text style={styles.gridSub5D}>{t("home_settings_sub")}</Text></View></Banner></TouchableOpacity>
        </View>
      </View>
    );
    const renderProduct=({item:p})=>{
      const com=Math.round(p.price*R.FRAIS_PRODUIT); const tot=p.price+R.BASE+com; const bloq=Date.now()-p.last<R.BLOQUE*86400000; const fav=favorites.includes(p.id);
      return (
        <TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelected(p); nav("product"); }}>
          <Image source={{uri:p.img}} style={styles.card5DImg}/>
          <View style={styles.card5DBody}>
            <View style={styles.shopRow5D}><Image source={{uri:IMG.boutique}} style={styles.shopAvatar5D}/><Text style={styles.shopName5D}>{p.shop} • {p.rayon}km</Text></View>
            <Text style={[styles.productName5D,{color:T.text}]}>{p.name}</Text>
            <View style={styles.priceBlock5D}>
              <Text style={styles.productPrice5D}>{t("tag_product")}: {money(p.price)} {t("product_price_real")}</Text>
              <Text style={styles.comPrice5D}>{t("product_commission_label")} = {money(com)}</Text>
              <Text style={styles.totalPrice5D}>{t("product_total_label")} {money(tot)}</Text>
            </View>
            {p.stock<=0 && <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ {t("out_of_stock")}</Text></View>}
          </View>
          <TouchableOpacity onPress={()=>toggleFavorite(p.id)} style={styles.favBtn5D}><Text style={{fontSize:16}}>{fav?"❤️":"🤍"}</Text></TouchableOpacity>
        </TouchableOpacity>
      );
    };
    return (
      <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}>
        <FlatList data={user.guest ? (debouncedSearch!==''?filteredExact:[]) : ((debouncedSearch===''||showAlternatives)?filtered:[])} keyExtractor={(item)=>item.id} renderItem={renderProduct} ListHeaderComponent={ListHeader} ListFooterComponent={ListFooter} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} initialNumToRender={8} windowSize={5}/>
        <Bottom5D goHome={home} nav={nav} page={page} orders={orders} bookings={bookings}/>
      </SafeAreaView>
    );
  }

  if(page==="product"&&selected){
    const com=Math.round(selected.price*R.FRAIS_PRODUIT); const tot=selected.price+R.BASE+com; const rating=getRating(selected.merchantId);
    return (<Page title="Produit" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <ImageBackground source={{uri:selected.img}} style={styles.detailHero5D} imageStyle={{borderRadius:24}}><View style={styles.detailOverlay5D}><Text style={styles.detailName5D}>{selected.name}</Text><Text style={styles.detailPriceReal5D}>{money(selected.price)} {t("product_price_real")}</Text></View></ImageBackground>
      {rating && <Text style={styles.ratingLine5D}>⭐ {rating.avg}/5 ({rating.count} {t("reviews_word")}) — {selected.shop}</Text>}
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <View style={styles.separationBlock}>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>{t("tag_product")}</Text><Text style={styles.sepValue}>{money(selected.price)}</Text></View>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>{t("tag_delivery")} {R.BASE}F</Text><Text style={styles.sepValueLiv}>{R.SPLIT_LIVREUR}+{R.SPLIT_MARCHAND}+{R.SPLIT_MERCA}</Text></View>
          <View style={[styles.sepRow,styles.sepTotal]}><Text style={styles.sepLabelTotal}>{t("product_total_label")}</Text><Text style={styles.sepValueTotal}>{money(tot)}</Text></View>
        </View>
      </View>
      {selected.stock>0 ? <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("commander"):nav("checkout")}><Text style={styles.buy5DT}>{t("product_order_btn")}</Text></TouchableOpacity> : <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ {t("out_of_stock")}</Text></View>}
    </Page>);
  }

  if(page==="checkout"){
    const com=selected?Math.round(selected.price*R.FRAIS_PRODUIT):0; const tot=selected?selected.price+R.BASE+com:0;
    return (<Page title="Checkout" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={styles.security5D}><Text style={styles.securityTitle5D}>🧪 {t("tag_simulation")}</Text><Text style={styles.securityText5D}>{t("escrow_note")}</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selected?.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selected?.name}</Text><Text style={styles.checkoutTotal5D}>{t("product_total_label")} {money(tot)}</Text></View></View></View>
      <TouchableOpacity style={[styles.buy5D,orderSubmitting&&{opacity:0.5}]} disabled={orderSubmitting} onPress={()=>confirm(t("confirm_title"),`${t("pay_label")} ${money(tot)} ?`,()=>createOrder(selected,"Livraison MERCA"))}><Text style={styles.buy5DT}>{orderSubmitting?t("sending_label"):`🚚 ${t("tag_delivery")} ${money(tot)}`}</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.secondary5D,orderSubmitting&&{opacity:0.5}]} disabled={orderSubmitting} onPress={()=>confirm(t("withdrawal_title"),`${t("withdrawal_title")} ${money(selected.price)} ?`,()=>createOrder(selected,"Retrait boutique"))}><Text style={styles.secondary5DT}>{orderSubmitting?t("sending_label"):t("withdrawal_btn")}</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="wallet"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"💳",label:"Wallet",desc:t("wallet_gate_desc")}} onActivate={()=>setUser(null)} actionLabel={t("signup_btn")}/>;
    return (<Page title="Wallet" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.wallet.color} icon={BANNERS.wallet.icon} style={styles.walletHero5D} radius={24}><View style={styles.walletOverlay5D}><Text style={styles.walletLabel5D}>{t("tag_simulation")}</Text><Text style={styles.walletBalance5D}>{money(wallet)}</Text><Text style={styles.walletSub5D}>{points}pts • {getLevel()}</Text></View></Banner>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("unlock_pin_title")}</Text>
        <TextInput value={pinInput} onChangeText={setPinInput} placeholder="PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={async()=>{
          if(Date.now()<blocked) return Alert.alert("Bloqué","Réessaie plus tard (simulation)");
          const h=await hashPin(pinInput);
          if(h!==walletPin){ const f=fails+1; if(f>=3){ setBlocked(Date.now()+300000); setFails(0); Alert.alert("Bloqué 5min"); } else { setFails(f); Alert.alert(`Reste ${3-f} essai(s)`); } return; }
          setFails(0); setPinInput(""); Alert.alert("Débloqué - SIMULATION");
        }}><Text style={styles.buy5DT}>{t("unlock_btn")}</Text></TouchableOpacity>
      </View>
      {walletHistory.map(h=>(<View key={h.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={[styles.historyIcon5D,{backgroundColor:h.color+"20"}]}><Text>{h.icon}</Text></View><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{h.type}</Text></View><Text style={[styles.historyAmount5D,{color:h.color}]}>{h.amount!==0?money(h.amount):''}</Text></View>))}
    </Page>);
  }

  // ---- Espace pro (choix boutique/livraison/bureau) ----
  if(page==="espaces"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🧰",label:"Espace",desc:t("espace_gate_desc")}} onActivate={()=>setUser(null)} actionLabel={t("signup_btn")}/>;
    return (<Page title="Mon Espace" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Text style={styles.ruleD5D}>{t("espaces_hint")}</Text>
      <EspaceCard T={T} active={hasRole("commercant")} icon={ROLES_INFO.commercant.icon} color={ROLES_INFO.commercant.color} title={t("espace_boutique_title")} desc={t("espace_boutique_desc")} onPress={()=>hasRole("commercant")?nav("merchant"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("livreur")} icon={ROLES_INFO.livreur.icon} color={ROLES_INFO.livreur.color} title={t("espace_livraison_title")} desc={`${R.SPLIT_LIVREUR}F + ${R.POINTS_PAR_LIVRAISON}pts`} onPress={()=>hasRole("livreur")?nav("courier"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("pro")} icon={ROLES_INFO.pro.icon} color={ROLES_INFO.pro.color} title={t("espace_bureau_title")} desc={t("espace_bureau_desc")} onPress={()=>hasRole("pro")?nav("pro"):nav("settings")}/>
    </Page>);
  }

  if(page==="merchant"){
    if(!hasRole("commercant")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.commercant} onActivate={()=>nav("settings")} actionLabel={t("activate_in_settings_btn")}/>;
    const my=products.filter(p=>p.shop===user.shopName); const rating=getRating(user.id);
    return (<Page title={`${t("boutique_label")} - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🏪 {user.shopName} {isVerified("commercant")?"✅":""}</Text><Text style={styles.spaceSub5D}>{rating?`⭐ ${rating.avg}/5 (${rating.count} ${t("reviews_word")})`:t("no_reviews_yet")}</Text></View></Banner>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAdd(true)}><Image source={{uri:IMG.boutique}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>{t("add_product_btn")}</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>{t("ad_fb_title")}</Text><Text style={styles.securityText5D}>{t("ad_fb_product_text")}</Text></View>
      {my.map(p=>{ const bloq=Date.now()-p.last<R.BLOQUE*86400000; return (
        <View key={p.id} style={[styles.myProd5D,{backgroundColor:T.card}]}><Image source={{uri:p.img}} style={styles.myProdImg5D}/><View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{p.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>{t("price_label")} {money(p.price)} • {t("stock_label")} {p.stock}</Text></View><TouchableOpacity onPress={()=>shareProduct(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("share_btn")}</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEdit(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("edit_btn")}</Text></TouchableOpacity></View>
      );})}

      <Text style={[styles.section5D,{color:T.text}]}>{t("incoming_orders_title")}</Text>
      {incomingOrders.length===0 && <Text style={styles.settingsSub}>{t("no_orders_yet")}</Text>}
      {incomingOrders.map(o=>(
        <View key={o.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text><Text style={styles.myProdPrice5D}>{o.status} • {money(o.total)}</Text></View>
          {o.step<=1 && <TouchableOpacity onPress={()=>doAdvance(o, refreshIncomingOrders)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("next_step_btn")}</Text></TouchableOpacity>}
        </View>
      ))}
      <Modal visible={showAdd} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>{t("new_product_title")}</Text>
        <TextInput value={npName} onChangeText={setNpName} placeholder={t("name_placeholder")} style={styles.input5D}/>
        <TextInput value={npPrice} onChangeText={setNpPrice} placeholder={t("price_fcfa_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={npStock} onChangeText={setNpStock} placeholder={t("stock_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{CATS.filter(c=>c!=="Tous").map(c=><TouchableOpacity key={c} style={[styles.cat5D,npCat===c&&styles.cat5DActive]} onPress={()=>setNpCat(c)}><Text style={npCat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createProd}><Text style={styles.buy5DT}>{t("publish_btn")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAdd(false)}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEdit} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>{t("edit_btn")} {showEdit?.name}</Text>
        <TextInput value={editPrice} onChangeText={setEditPrice} placeholder={t("new_price_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={editStock} onChangeText={setEditStock} placeholder={t("new_stock_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateProd}><Text style={styles.buy5DT}>{t("save_btn")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEdit(null)}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  // ---- Parcourir les services (client) ----
  if(page==="services"){
    return (<Page title="Services Pro" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>{t("services_title_banner")}</Text></View></Banner>
      {dispoServices.length===0 && <View style={styles.empty5D}><Text>{t("services_empty")}</Text></View>}
      {dispoServices.map(s=>{ const rating=getRating(s.proId); return (
        <TouchableOpacity key={s.id} style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedService(s); nav("serviceDetail"); }}>
          <Image source={{uri:IMG.bureau}} style={styles.card5DImg}/>
          <View style={styles.card5DBody}>
            <Text style={styles.shopName5D}>{s.bureau} • {s.domaine}</Text>
            <Text style={[styles.productName5D,{color:T.text}]}>{s.name}</Text>
            <Text style={styles.productPrice5D}>{money(s.price)}{rating?` • ⭐ ${rating.avg}`:''}</Text>
          </View>
        </TouchableOpacity>
      );})}
    </Page>);
  }

  if(page==="serviceDetail" && selectedService){
    const rating=getRating(selectedService.proId);
    return (<Page title="Service" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedService.name}</Text>
        <Text style={styles.settingsSub}>{selectedService.bureau} • {selectedService.domaine} {rating?`• ⭐ ${rating.avg}/5 (${rating.count})`:''}</Text>
        <Text style={[styles.settingsLine,{color:T.text,marginTop:8}]}>{money(selectedService.price)}</Text>
        <Text style={styles.settingsSub}>{cleanDesc(selectedService.desc)}</Text>
      </View>
      <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("réserver ce service"):nav("bookingSlot")}><Text style={styles.buy5DT}>{t("service_reserve_btn")}</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingSlot" && selectedService){
    const slots=genSlots(); const com=Math.round(selectedService.price*R.FRAIS_SERVICE); const tot=selectedService.price+com;
    return (<Page title="Choisir un créneau" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedService.name}</Text><Text style={styles.checkoutTotal5D}>{t("product_total_label")} {money(tot)}</Text></View>
      {slots.map(s=>(<TouchableOpacity key={s.id} style={[styles.slotBtn5D, selectedSlot?.id===s.id&&styles.slotBtnActive5D]} onPress={()=>setSelectedSlot(s)}><Text style={[styles.slotBtnT5D, selectedSlot?.id===s.id&&{color:"#fff"}]}>📅 {s.label}</Text></TouchableOpacity>))}
      <TouchableOpacity style={[styles.buy5D,(!selectedSlot||bookingSubmitting)&&{opacity:0.4}]} disabled={!selectedSlot||bookingSubmitting} onPress={()=>confirm(t("confirm_booking_title"),`${t("pay_label")} ${money(tot)} ${t("booking_slot_label")} ${selectedSlot?.label} ?`,createBooking)}><Text style={styles.buy5DT}>{bookingSubmitting?t("sending_label"):t("confirm_and_pay_btn")}</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingTracking"){
    return (<Page title="Ma réservation" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedBooking ? <View style={styles.empty5D}><Text>{t("no_booking_msg")}</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedBooking.service.name} - Code {selectedBooking.bookingCode}</Text>
          <Text style={styles.settingsSub}>{selectedBooking.slot.label} • {money(selectedBooking.total)}</Text>
        </View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{BOOKING_STEPS.map((s,i)=>{ const act=i<=selectedBooking.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedBooking.step<2 && <TouchableOpacity style={styles.secondary5D} onPress={()=>cancelBooking(selectedBooking)}><Text style={styles.secondary5DT}>{t("cancel_booking_btn")}</Text></TouchableOpacity>}
        {selectedBooking.step===2 && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedBooking.proId, undefined, selectedBooking.id)}><Text style={styles.buy5DT}>{t("leave_review_btn")}</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedBooking.id); nav("support"); }}><Text style={styles.secondary5DT}>{t("support_btn")}</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview} t={t}/>
    </Page>);
  }

  // ---- Bureau Pro ----
  if(page==="pro"){
    if(!hasRole("pro")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.pro} onActivate={()=>nav("settings")} actionLabel={t("activate_in_settings_btn")}/>;
    const my=services.filter(s=>s.proId===user.id); const rating=getRating(user.id);
    return (<Page title={`${t("bureau_pro_label")} - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.pro.color} icon={BANNERS.pro.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🧑‍💼 {user.bureau} {isVerified("pro")?"✅":""}</Text><Text style={styles.spaceSub5D}>{user.domaine} • {rating?`⭐ ${rating.avg}/5 (${rating.count} ${t("reviews_word")})`:t("no_reviews_yet")}</Text></View></Banner>

      {incomingBookings.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>{t("my_bookings_title")}</Text>
        {incomingBookings.map(b=>(<View key={b.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{b.service.name} - {b.slot.label}</Text><Text style={styles.myProdPrice5D}>Code {b.bookingCode} • {b.status}</Text></View>
          {b.status==="Demande envoyée" && <TouchableOpacity onPress={()=>proConfirmBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("confirm_title")}</Text></TouchableOpacity>}
          {b.status==="Confirmée" && <TouchableOpacity onPress={()=>proCompleteBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("finish_btn")}</Text></TouchableOpacity>}
        </View>))}
      </>)}

      <Text style={[styles.section5D,{color:T.text}]}>{t("my_services_title")}</Text>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAddService(true)}><Image source={{uri:IMG.bureau}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>{t("add_service_btn")}</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>{t("ad_fb_title")}</Text><Text style={styles.securityText5D}>{t("ad_fb_service_text")}</Text></View>
      {my.map(s=>{ const bloq=Date.now()-s.last<R.BLOQUE*86400000; return (
        <View key={s.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <Image source={{uri:IMG.bureau}} style={styles.myProdImg5D}/>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{s.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>{s.domaine} • {t("tariff_label")} {money(s.price)} • {s.dispo?`✅ ${t("available_label")}`:`⏸ ${t("unavailable_label")}`}</Text></View>
          <View style={{gap:6}}><TouchableOpacity onPress={()=>shareService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("share_btn")}</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEditService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{t("edit_tariff_btn")}</Text></TouchableOpacity><TouchableOpacity onPress={()=>toggleDispo(s.id)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{s.dispo?t("pause_btn"):t("activate_btn")}</Text></TouchableOpacity></View>
        </View>
      );})}
      <Modal visible={showAddService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>{t("new_service_title")}</Text>
        <TextInput value={nsName} onChangeText={setNsName} placeholder={t("service_name_placeholder")} style={styles.input5D}/>
        <TextInput value={nsPrice} onChangeText={setNsPrice} placeholder={t("tariff_fcfa_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={nsDesc} onChangeText={setNsDesc} placeholder={t("short_desc_placeholder")} style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,nsDomaine===d&&styles.cat5DActive]} onPress={()=>setNsDomaine(d)}><Text style={nsDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createService}><Text style={styles.buy5DT}>{t("publish_btn")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAddService(false)}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEditService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>{t("edit_tariff_title")}</Text>
        <TextInput value={esPrice} onChangeText={setEsPrice} placeholder={t("new_tariff_placeholder")} keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateService}><Text style={styles.buy5DT}>{t("save_btn")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEditService(null)}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="tracking"){
    return (<Page title="Suivi" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedOrder ? <View style={styles.empty5D}><Text>{t("no_order_msg")}</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selectedOrder.product.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedOrder.product.name} - Code {selectedOrder.codeLivraison}</Text><Text style={styles.checkoutTotal5D}>{t("product_total_label")} {money(selectedOrder.total)}</Text></View></View></View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{STEPS.map((s,i)=>{ const act=i<=selectedOrder.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedOrder.step<4 && <Text style={[styles.settingsSub,{textAlign:"center",marginTop:8}]}>{t("waiting_next_step")}</Text>}
        {selectedOrder.step===4 && selectedOrder.status!=="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>confirmReception(selectedOrder)}><Text style={styles.buy5DT}>{t("confirm_reception_btn")}</Text></TouchableOpacity>}
        {selectedOrder.status==="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedOrder.merchantId, selectedOrder.id, undefined)}><Text style={styles.buy5DT}>{t("leave_review_btn")}</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedOrder.id); nav("support"); }}><Text style={styles.secondary5DT}>{t("support_btn")}</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview} t={t}/>
    </Page>);
  }

  // ---- Support (messagerie + litige), commun aux commandes et réservations ----
  if(page==="support"){
    const msgs=threadMessages(supportThread);
    return (<Page title="Support" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card,maxHeight:300}]}>
        {supportLoading && msgs.length===0 && <Text style={styles.settingsSub}>{t("support_loading")}</Text>}
        {!supportLoading && msgs.length===0 && <Text style={styles.settingsSub}>{t("support_no_messages")}</Text>}
        {msgs.map(m=>(<View key={m.id} style={[styles.msgBubble5D, m.from==="client"?styles.msgClient5D:styles.msgVendor5D]}><Text style={[styles.msgText5D, m.from!=="client"&&{color:"#111"}]}>{m.text}</Text></View>))}
      </View>
      <View style={{flexDirection:"row",gap:8}}>
        <TextInput value={messageInput} onChangeText={setMessageInput} placeholder={t("message_placeholder")} style={[styles.input5D,{flex:1,marginTop:0}]}/>
        <TouchableOpacity style={styles.sendBtn5D} onPress={sendMessage}><Text style={{color:"#fff",fontWeight:"800"}}>➤</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dangerBtn5D} onPress={()=>setShowDisputeForm(true)}><Text style={styles.dangerBtn5DT}>{t("report_problem_btn")}</Text></TouchableOpacity>
      {disputes.filter(d=>d.threadId===supportThread).map(d=>(<View key={d.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{d.reason}</Text><Text style={styles.settingsSub}>{d.description}</Text></View><Text style={styles.roleBadge5DT}>{d.status}</Text></View>))}
      <Modal visible={showDisputeForm} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>{t("report_problem_btn")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{DISPUTE_REASONS.map(r=><TouchableOpacity key={r} style={[styles.cat5D,disputeReason===r&&styles.cat5DActive]} onPress={()=>setDisputeReason(r)}><Text style={disputeReason===r?styles.cat5DActiveT:styles.cat5DT}>{r}</Text></TouchableOpacity>)}</ScrollView>
        <TextInput value={disputeDesc} onChangeText={setDisputeDesc} placeholder={t("dispute_describe_placeholder")} multiline style={[styles.input5D,{height:80}]}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitDispute}><Text style={styles.buy5DT}>{t("send_btn")}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowDisputeForm(false)}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="client"){
    const favProducts = products.filter(p=>favorites.includes(p.id));
    return (<Page title={`Client - ${points}pts`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.spaceHero5D,{alignItems:"center",justifyContent:"center"}]}><Avatar user={user} size={72}/><Text style={[styles.spaceTitle5D,{color:"#111",marginTop:8}]}>{user.name}</Text><Text style={{color:"#555",fontSize:11}}>{user.city} • {user.phone}</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("client_roles_title")}</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8}}>{user.roles.map(r=>(<RoleBadge key={r} info={ROLES_INFO[r]} verified={isVerified(r)}/>))}</View>
      </View>
      {favProducts.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>{t("my_favorites_title")}</Text>
        {favProducts.map(p=>(<TouchableOpacity key={p.id} style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelected(p); nav("product"); }}><Image source={{uri:p.img}} style={styles.card5DImg}/><View style={styles.card5DBody}><Text style={[styles.productName5D,{color:T.text}]}>{p.name}</Text><Text style={styles.productPrice5D}>{money(p.price)}</Text></View></TouchableOpacity>))}
      </>)}
      <Text style={[styles.section5D,{color:T.text}]}>{t("my_orders_title")}</Text>
      <FlatList data={orders} keyExtractor={(o)=>o.id} scrollEnabled={false} renderItem={({item:o})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedOrder(o); nav("tracking"); }}><View style={{flexDirection:'row',gap:10}}><Image source={{uri:o.product.img}} style={styles.orderImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text></View></View></TouchableOpacity>)}/>
      <Text style={[styles.section5D,{color:T.text}]}>{t("my_bookings_title")}</Text>
      <FlatList data={bookings} keyExtractor={(b)=>b.id} scrollEnabled={false} renderItem={({item:b})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedBooking(b); nav("bookingTracking"); }}><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{b.service.name} • Code {b.bookingCode}</Text><Text style={styles.settingsSub}>{b.status}</Text></View></TouchableOpacity>)}/>
    </Page>);
  }

  if(page==="courier"){
    if(!hasRole("livreur")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.livreur} onActivate={()=>nav("settings")} actionLabel={t("activate_in_settings_btn")}/>;
    return (<Page title={`${t("courier_label")} - ${R.SPLIT_LIVREUR}F`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.courier.color} icon={BANNERS.courier.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🚚 {user.vehicule} {isVerified("livreur")?"✅":""}</Text><Text style={styles.spaceSub5D}>{R.SPLIT_LIVREUR}F + {R.POINTS_PAR_LIVRAISON} {t("per_delivery_suffix")}</Text></View></Banner>
      <Text style={[styles.section5D,{color:T.text}]}>{t("available_deliveries_title")}</Text>
      {availableDeliveries.length===0 && <Text style={styles.settingsSub}>{t("no_deliveries_available")}</Text>}
      {availableDeliveries.map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, async()=>{ await refreshAvailableDeliveries(); await refreshMyDeliveries(); })}><Text style={styles.buy5DT}>{t("take_delivery_btn")} - {R.SPLIT_LIVREUR}F</Text></TouchableOpacity></View>))}
      <Text style={[styles.section5D,{color:T.text}]}>{t("my_current_deliveries_title")}</Text>
      {myDeliveries.filter(o=>o.step<4).length===0 && <Text style={styles.settingsSub}>{t("no_deliveries_in_progress")}</Text>}
      {myDeliveries.filter(o=>o.step<4).map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><Text style={styles.settingsSub}>{o.status}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, refreshMyDeliveries)}><Text style={styles.buy5DT}>{t("mark_delivered_btn")}</Text></TouchableOpacity></View>))}
    </Page>);
  }

  if(page==="permuta"){
    return (<Page title="PERMUTA" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>{t("permuta_title_banner")}</Text></View></Banner>
      {permuta.map(it=>(<View key={it.id} style={[styles.permutaCard5D,{backgroundColor:T.card}]}><View style={styles.permutaRow5D}><Image source={{uri:it.img1}} style={styles.permutaImg5D}/><Text>🔄</Text><Image source={{uri:it.img2}} style={styles.permutaImg5D}/></View><Text style={[styles.permutaName5D,{color:T.text}]}>{it.name} - SIMULATION</Text></View>))}
    </Page>);
  }

  if(page==="orders"){
    return (<Page title="Commandes" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <FlatList data={orders} keyExtractor={(o)=>o.id} scrollEnabled={false} renderItem={({item:o})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedOrder(o); nav("tracking"); }}><View style={{flexDirection:'row',gap:10}}><Image source={{uri:o.product.img}} style={styles.orderImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text><Text style={styles.fidelity5D}>Total {money(o.total)}</Text></View></View></TouchableOpacity>)}/>
    </Page>);
  }

  // ================= MERCA CERCLE (parrainage) =================
  if(page==="circle"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🎁",label:"MERCA CERCLE",color:"#F5A623",desc:"Le parrainage est réservé aux comptes inscrits"}} onActivate={()=>setUser(null)} actionLabel={t("signup_btn")}/>;
    return (<Page title="🎁 MERCA CERCLE" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:"#F5A623"}]}>
        <Text style={{color:"#fff",fontWeight:"900",fontSize:14}}>{t("circle_my_code_title")}</Text>
        <Text style={{color:"#fff",fontWeight:"900",fontSize:32,letterSpacing:4,marginTop:8}}>{circleData?.code||"..."}</Text>
        <Text style={{color:"rgba(255,255,255,0.85)",fontSize:11,marginTop:8}}>{t("circle_invite_note")} {money(500)}.</Text>
      </View>
      <TouchableOpacity style={styles.buy5D} onPress={shareCircleCode}><Text style={styles.buy5DT}>{t("circle_share_btn")}</Text></TouchableOpacity>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("circle_my_circle_title")}</Text>
        <Text style={[styles.settingsLine,{color:T.text}]}>{circleData?.invitedCount||0} {t("circle_invited_count")}</Text>
        <Text style={styles.settingsSub}>{circleData?.activeCount||0} {t("circle_active_count")}</Text>
      </View>
    </Page>);
  }

  // ================= ADMINISTRATION (toi uniquement) =================
  if(page==="admin"){
    if(!user.isAdmin) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🛡️",label:"Administration",color:"#111",desc:"Accès réservé"}} onActivate={home} actionLabel="Retour à l'accueil"/>;

    if(!adminUnlocked){
      return (<Page title="🛡️ Administration MERCA" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>🔒 Mot de passe administrateur</Text>
          <Text style={styles.settingsSub}>Une deuxième protection, séparée de ton compte - redemandée à chaque ouverture.</Text>
          <TextInput value={adminPasswordInput} onChangeText={setAdminPasswordInput} placeholder="Mot de passe" secureTextEntry style={styles.input5D}/>
          {!!adminError && <Text style={{color:"#e74c3c",marginTop:8}}>{adminError}</Text>}
          <TouchableOpacity style={styles.buy5D} onPress={unlockAdmin}><Text style={styles.buy5DT}>Déverrouiller</Text></TouchableOpacity>
        </View>
      </Page>);
    }

    return (<Page title="🛡️ Administration MERCA" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <TouchableOpacity style={styles.secondary5D} onPress={refreshAdmin}><Text style={styles.secondary5DT}>🔄 Rafraîchir</Text></TouchableOpacity>
      {adminStats && (
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>📊 Statistiques</Text>
          <Text style={[styles.settingsLine,{color:T.text}]}>{adminStats.totalUsers} utilisateurs</Text>
          <Text style={styles.settingsSub}>{adminStats.totalCommercants} commerçants • {adminStats.totalLivreurs} livreurs • {adminStats.totalPros} employés pro</Text>
          <Text style={styles.settingsSub}>{adminStats.totalProducts} produits • {adminStats.totalOrders} commandes • {adminStats.totalBookings} réservations</Text>
          <Text style={[styles.settingsLine,{color:T.text,marginTop:8}]}>Revenus commission</Text>
          <Text style={styles.settingsSub}>Produits: {money(adminStats.revenueProducts)} • Services: {money(adminStats.revenueServices)}</Text>
        </View>
      )}
      <Text style={[styles.section5D,{color:T.text}]}>👥 Utilisateurs ({adminUsers.length})</Text>
      {adminUsers.map(u=>(
        <View key={u.id} style={[styles.myProd5D,{backgroundColor:T.card, flexDirection:"column", alignItems:"stretch"}]}>
          <Text style={[styles.myProdName5D,{color:T.text}]}>{u.name||"(sans nom)"} {u.isAdmin?"🛡️":""} {u.isSuspended?"⛔":""}</Text>
          <Text style={styles.myProdPrice5D}>{u.phone} • {u.city||"?"} • {(u.roles||[]).join(", ")}</Text>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8}}>
            <TouchableOpacity onPress={()=>adminViewDetail(u)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>🔍 Détail</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{ setShowWalletAdjust(u); setWalletAdjustAmount(""); }} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>💰 Ajuster wallet</Text></TouchableOpacity>
            {u.id!==user.id && <TouchableOpacity onPress={()=>adminToggleSuspend(u)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{u.isSuspended?"✅ Réactiver":"⛔ Suspendre"}</Text></TouchableOpacity>}
            {u.id!==user.id && <TouchableOpacity onPress={()=>adminToggleAdminRights(u)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{u.isAdmin?"🛡️ Retirer admin":"🛡️ Rendre admin"}</Text></TouchableOpacity>}
            {(u.roles||[]).filter(r=>r!=="client" && !(u.verifiedRoles||[]).includes(r)).map(r=>(
              <TouchableOpacity key={r} onPress={()=>adminVerifyRole(u,r)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>✅ Vérifier {r}</Text></TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Modal visible={!!adminDetail} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        {adminDetail && (<>
          <Text style={styles.modalTitle5D}>🔍 {adminDetail.user.name||"(sans nom)"}</Text>
          <Text style={styles.settingsSub}>{adminDetail.user.phone} • {adminDetail.user.city||"?"}</Text>
          <Text style={[styles.settingsLine,{color:"#111",marginTop:8}]}>Portefeuille : {adminDetail.walletBalance!=null?money(adminDetail.walletBalance):"introuvable"}</Text>
          <Text style={styles.settingsSub}>Achats: {adminDetail.boughtOrders} • Ventes (produits): {adminDetail.soldOrders} • Livraisons: {adminDetail.deliveries}</Text>
          <Text style={styles.settingsSub}>Produits publiés: {adminDetail.myProducts} • Réservations (client): {adminDetail.myBookingsAsClient} • Réservations (pro): {adminDetail.myBookingsAsPro}</Text>
          <Text style={styles.settingsSub}>Rôles: {(adminDetail.user.roles||[]).join(", ")} • Vérifiés: {(adminDetail.user.verifiedRoles||[]).join(", ")||"aucun"}</Text>
          <TouchableOpacity style={styles.secondary5D} onPress={()=>setAdminDetail(null)}><Text>Fermer</Text></TouchableOpacity>
        </>)}
      </View></View></Modal>

      <Modal visible={!!showWalletAdjust} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>💰 Ajuster le portefeuille de {showWalletAdjust?.name}</Text>
        <Text style={styles.settingsSub}>Montant positif = créditer, négatif = débiter (ex: -1000)</Text>
        <TextInput value={walletAdjustAmount} onChangeText={setWalletAdjustAmount} placeholder="Montant (FCFA)" keyboardType="numbers-and-punctuation" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitWalletAdjust}><Text style={styles.buy5DT}>Valider</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowWalletAdjust(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  // ================= PARAMÈTRES =================
  if(page==="settings"){
    const missingRoles = Object.keys(ROLES_INFO).filter(r=>r!=="client" && !hasRole(r));
    const verifiableRoles = (user.roles||[]).filter(r=>r!=="client" && !isVerified(r));
    return (<Page title="Paramètres" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card, alignItems:"center"}]}>
        <Avatar user={user} size={80}/>
        <TouchableOpacity style={styles.secondary5D} onPress={pickAvatar}><Text style={styles.secondary5DT}>📷 Changer ma photo de profil</Text></TouchableOpacity>
        <Text style={styles.settingsSub}>Utilisée dans toute l'app (pas l'icône du téléphone — voir note ci-dessous)</Text>
      </View>

      {user.isAdmin && (
        <TouchableOpacity style={[styles.card5DLarge,{backgroundColor:"#111"}]} onPress={()=>nav("admin")}>
          <Text style={{color:"#fff",fontSize:14,fontWeight:"900"}}>🛡️ Administration MERCA</Text>
          <Text style={{color:"rgba(255,255,255,0.7)",fontSize:11,marginTop:2}}>Statistiques, utilisateurs, vérifications, suspensions</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("settings_account_title")}</Text>
        <Text style={[styles.settingsLine,{color:T.text}]}>{user.name}</Text>
        <Text style={styles.settingsSub}>{user.phone||t("settings_no_phone")} • {user.city}</Text>
        {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={openAccountEdit}><Text style={styles.secondary5DT}>{t("settings_edit_info_btn")}</Text></TouchableOpacity>}
        {user.guest && <TouchableOpacity style={styles.buy5D} onPress={()=>setUser(null)}><Text style={styles.buy5DT}>{t("settings_create_account_btn")}</Text></TouchableOpacity>}
      </View>

      {!user.guest && (
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>🔀 Mes comptes</Text>
          <Text style={styles.settingsSub}>Bascule entre tes comptes sans avoir à te reconnecter à chaque fois.</Text>
          {savedAccounts.map(acc=>(
            <View key={acc.phone} style={{flexDirection:"row",alignItems:"center",marginTop:10}}>
              <TouchableOpacity style={{flex:1,flexDirection:"row",alignItems:"center",gap:10}} onPress={()=>acc.phone!==user.phone && switchToAccount(acc)}>
                <Avatar user={acc.user} size={36}/>
                <View style={{flex:1}}>
                  <Text style={{color:T.text,fontWeight:"800",fontSize:13}}>{acc.user.name}{acc.phone===user.phone?" (actif)":""}</Text>
                  <Text style={styles.settingsSub}>{acc.phone}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>removeSavedAccount(acc.phone)} style={{padding:8}}><Text style={{fontSize:16}}>✕</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.secondary5D} onPress={addAnotherAccount}><Text style={styles.secondary5DT}>➕ Ajouter un compte</Text></TouchableOpacity>
        </View>
      )}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🌐 {t("lang_label")}</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:8}}>
          {LANGUAGES.map(l=>(
            <TouchableOpacity key={l.code} onPress={()=>setLang(l.code)} style={[styles.cat5D,lang===l.code&&styles.cat5DActive]}>
              <Text style={lang===l.code?styles.cat5DActiveT:styles.cat5DT}>{l.flag} {l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!user.guest && (<>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🎭 Mes rôles</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8,marginBottom:10}}>{user.roles.map(r=>(<RoleBadge key={r} info={ROLES_INFO[r]} verified={isVerified(r)}/>))}</View>
        {missingRoles.map(r=>(<TouchableOpacity key={r} style={styles.secondary5D} onPress={()=>{ setRoleModal(r); setRoleExtra(""); }}><Text style={styles.secondary5DT}>{ROLES_INFO[r].icon} Devenir {ROLES_INFO[r].label}</Text></TouchableOpacity>))}
      </View>

      {verifiableRoles.length>0 && (
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>🛡 Vérification d'identité</Text>
          <Text style={styles.settingsSub}>Un badge ✅ rassure les autres utilisateurs. SIMULATION : dans une vraie version, un humain ou un service tiers doit contrôler le document.</Text>
          {verifiableRoles.map(r=>(<TouchableOpacity key={r} style={styles.secondary5D} onPress={()=>{ setKycModal(r); setKycDoc(""); }}><Text style={styles.secondary5DT}>Vérifier {ROLES_INFO[r].label}</Text></TouchableOpacity>))}
        </View>
      )}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🔐 Sécurité</Text>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowPinChange(true)}><Text style={styles.secondary5DT}>Changer le code PIN du wallet</Text></TouchableOpacity>
      </View>
      </>)}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("settings_appearance_title")}</Text>
        <View style={styles.switchRow}><Text style={{color:T.text}}>{t("settings_dark_mode")}</Text><Switch value={dark} onValueChange={setDark}/></View>
        <View style={styles.switchRow}><Text style={{color:T.text}}>{t("settings_notifications")}</Text><Switch value={notifEnabled} onValueChange={setNotifEnabled}/></View>
      </View>

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("settings_about_title")}</Text>
        <Text style={styles.settingsSub}>MERCA V7 - SIMULATION TEST - Pas bancaire réel, pas de vrai SMS</Text>
        <Text style={styles.settingsSub}>L'icône de l'app sur ton téléphone (écran d'accueil) ne peut pas être remplacée par une photo libre depuis l'app elle-même — c'est une restriction d'iOS et Android, pas une limite de MERCA. Ta photo de profil ci-dessus fonctionne partout dans l'app.</Text>
      </View>

      {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={logout}><Text style={styles.secondary5DT}>{t("settings_logout_btn")}</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.dangerBtn5D} onPress={resetAllData}><Text style={styles.dangerBtn5DT}>{t("settings_reset_btn")}</Text></TouchableOpacity>

      <Modal visible={!!roleModal} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        {roleModal && (<>
          <Text style={styles.modalTitle5D}>{ROLES_INFO[roleModal].icon} Devenir {ROLES_INFO[roleModal].label}</Text>
          <TextInput value={roleExtra} onChangeText={setRoleExtra} placeholder={ROLES_INFO[roleModal].champ} style={styles.input5D}/>
          {roleModal==="pro" && (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,roleDomaine===d&&styles.cat5DActive]} onPress={()=>setRoleDomaine(d)}><Text style={roleDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>)}
          <TouchableOpacity style={styles.buy5D} onPress={confirmAddRole}><Text style={styles.buy5DT}>Activer ce rôle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary5D} onPress={()=>setRoleModal(null)}><Text>Annuler</Text></TouchableOpacity>
        </>)}
      </View></View></Modal>

      <Modal visible={!!kycModal} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>🛡 Vérification - {kycModal&&ROLES_INFO[kycModal].label}</Text>
        <TextInput value={kycDoc} onChangeText={setKycDoc} placeholder="Numéro de pièce d'identité (CNI)" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitKyc}><Text style={styles.buy5DT}>Envoyer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setKycModal(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>

      <Modal visible={showAccountEdit} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>Modifier mes informations</Text>
        <TextInput value={accName} onChangeText={setAccName} placeholder="Nom" style={styles.input5D}/>
        <TextInput value={accPhone} onChangeText={setAccPhone} placeholder="Téléphone" keyboardType="phone-pad" style={styles.input5D}/>
        <TextInput value={accCity} onChangeText={setAccCity} placeholder="Ville" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={saveAccountEdit}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAccountEdit(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>

      <Modal visible={showPinChange} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>Changer le PIN (4 chiffres)</Text>
        <TextInput value={newPin} onChangeText={setNewPin} placeholder="Nouveau PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TextInput value={newPinConfirm} onChangeText={setNewPinConfirm} placeholder="Confirmer le PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={savePinChange}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowPinChange(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  return null;
}

// ---- Composants réutilisables ----

function Banner({color,icon,radius,style,children}){
  return (<View style={[style,{backgroundColor:color, borderRadius:radius||24, overflow:"hidden"}]}>
    <Text style={{position:"absolute", right:-14, bottom:-24, fontSize:120, opacity:0.16}}>{icon}</Text>
    {children}
  </View>);
}

function Avatar({user,size}){
  if(user?.avatarUri){
    return <Image source={{uri:user.avatarUri}} style={{width:size,height:size,borderRadius:size/2}}/>;
  }
  const initial = (user?.name||"?").trim().charAt(0).toUpperCase();
  return (<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:"#111",alignItems:"center",justifyContent:"center"}}>
    <Text style={{color:"#fff",fontWeight:"900",fontSize:size*0.4}}>{initial}</Text>
  </View>);
}

function ReviewModal({visible,rating,setRating,comment,setComment,onCancel,onSubmit,t}){
  return (<Modal visible={visible} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
    <Text style={styles.modalTitle5D}>{t("review_modal_title")}</Text>
    <View style={{flexDirection:"row",justifyContent:"center",gap:8,marginVertical:12}}>
      {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n} onPress={()=>setRating(n)}><Text style={{fontSize:30}}>{n<=rating?"⭐":"☆"}</Text></TouchableOpacity>))}
    </View>
    <TextInput value={comment} onChangeText={setComment} placeholder={t("review_comment_placeholder")} multiline style={[styles.input5D,{height:70}]}/>
    <TouchableOpacity style={styles.buy5D} onPress={onSubmit}><Text style={styles.buy5DT}>{t("review_submit_btn")}</Text></TouchableOpacity>
    <TouchableOpacity style={styles.secondary5D} onPress={onCancel}><Text>{t("cancel_btn")}</Text></TouchableOpacity>
  </View></View></Modal>);
}

function RoleBadge({info,verified}){
  return (<View style={[styles.roleBadge5D,{backgroundColor:info.color+"22",borderColor:info.color,borderWidth:1}]}>
    <Text style={[styles.roleBadge5DT,{color:info.color}]}>{info.icon} {info.label}{verified?" ✅":""}</Text>
  </View>);
}

function RoleCard({active,icon,color,label,desc,onPress}){
  return (<TouchableOpacity style={[styles.roleCard5D, active&&{borderColor:color, backgroundColor:color+"10"}]} onPress={onPress}>
    <View style={[styles.roleIconWrap5D,{backgroundColor:color}]}><Text style={{fontSize:22}}>{icon}</Text></View>
    <View style={{flex:1,marginLeft:12}}><Text style={styles.roleCard5DTitle}>{label}</Text><Text style={styles.roleCard5DDesc}>{desc}</Text></View>
    {active && <Text style={{fontSize:16,color}}>✓</Text>}
  </TouchableOpacity>);
}

function EspaceCard({T,active,icon,color,title,desc,onPress}){
  return (<TouchableOpacity style={[styles.espaceCard5D,{backgroundColor:T.card, opacity:active?1:0.55}]} onPress={onPress}>
    <View style={[styles.roleIconWrap5D,{backgroundColor:color,width:52,height:52,borderRadius:26}]}><Text style={{fontSize:26}}>{icon}</Text></View>
    <View style={{flex:1,marginLeft:12}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{title}</Text><Text style={styles.settingsSub}>{active?desc:"Non activé — appuie pour l'activer dans les Paramètres"}</Text></View>
  </TouchableOpacity>);
}

function RoleGate({T,back,home,nav,page,orders,bookings,info,onActivate,actionLabel}){
  return (<Page title={`${info.label} - Accès requis`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
    <View style={[styles.card5DLarge,{backgroundColor:T.card, alignItems:"center", paddingVertical:24}]}>
      <View style={[styles.roleIconWrap5D,{backgroundColor:info.color||"#111",width:64,height:64,borderRadius:32}]}><Text style={{fontSize:32}}>{info.icon}</Text></View>
      <Text style={[styles.cardTitle5D,{color:T.text, marginTop:10, textAlign:"center"}]}>{info.label} non disponible</Text>
      <Text style={[styles.settingsSub,{textAlign:"center",marginTop:6}]}>{info.desc}</Text>
      <TouchableOpacity style={styles.buy5D} onPress={onActivate}><Text style={styles.buy5DT}>{actionLabel}</Text></TouchableOpacity>
    </View>
  </Page>);
}

function Bottom5D({goHome,nav,page,orders,bookings}){
  const items=[
    {id:"home",icon:"🏠",label:"Accueil",active:page==="home",action:goHome,count:0},
    {id:"orders",icon:"📦",label:"Cmd",active:page==="orders",action:()=>nav("orders"),count:orders.length+bookings.length},
    {id:"espaces",icon:"🧰",label:"Espace",active:page==="espaces",action:()=>nav("espaces"),count:0,special:true},
    {id:"wallet",icon:"💳",label:"Wallet",active:page==="wallet",action:()=>nav("wallet"),count:0},
    {id:"client",icon:"👤",label:"Profil",active:page==="client",action:()=>nav("client"),count:0},
  ];
  return (<View style={styles.bottom5DWrapper}><View style={styles.bottom5DIsland}>
    {items.map(item=>(<TouchableOpacity key={item.id} onPress={item.action} style={[styles.bottomItem5D, item.active&&styles.bottomItemActive5D, item.special&&styles.bottomItemSpecial5D]}>
      <View style={[styles.bottomIconWrap5D, item.active&&styles.bottomIconActiveWrap5D, item.special&&styles.bottomIconSpecialWrap5D]}>
        <Text style={[styles.bottomIcon5D, item.active&&styles.bottomIconActive5D, item.special&&styles.bottomIconSpecial5DT]}>{item.icon}</Text>
        {item.count>0&&<View style={styles.badgeCount5D}><Text style={styles.badgeCountT5D}>{item.count}</Text></View>}
      </View>
      <Text style={[styles.bottomLabel5D, item.active&&styles.bottomLabelActive5D]}>{item.label}</Text>
      {item.active&&<View style={styles.activeDot5D}/>}
    </TouchableOpacity>))}
  </View></View>);
}

function Page({title,children,back,home,nav,page,orders,bookings,T}){
  return (<SafeAreaView style={[styles.container,{backgroundColor:T?T.bg:"#F6F7F9"}]}>
    <View style={[styles.pageHead5D,{backgroundColor:T?T.header:"#fff"}]}>
      <TouchableOpacity onPress={back} style={styles.back5D}><Text style={styles.backT5D}>‹</Text></TouchableOpacity>
      <Text style={[styles.pageTitle5D,{color:T?T.text:"#111"}]}>{title}</Text>
      <TouchableOpacity onPress={home} style={styles.home5D}><Text>🏠</Text></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.contentBottom5D} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    <Bottom5D goHome={home} nav={nav} page={page} orders={orders} bookings={bookings}/>
  </SafeAreaView>);
}

const styles=StyleSheet.create({
  container:{flex:1}, content:{padding:14,paddingBottom:100}, contentBottom5D:{padding:14,paddingBottom:110},
  header5D:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12,borderRadius:18,padding:12},
  headerLeft:{flexDirection:"row",alignItems:"center",gap:10}, logo5D:{fontSize:24,fontWeight:"900",letterSpacing:2}, logoSub5D:{fontSize:10,opacity:0.6},
  badge5D:{backgroundColor:"#111",paddingHorizontal:12,paddingVertical:8,borderRadius:14}, badge5DT:{color:"#fff",fontSize:14},
  hero5D:{height:190,borderRadius:24,overflow:"hidden",marginBottom:12}, hero5DOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",padding:16,justifyContent:"flex-end"},
  hero5DTitle:{color:"#fff",fontSize:18,fontWeight:"900"}, hero5DSub:{color:"#fff",fontSize:10,opacity:0.9,marginTop:4},
  search5D:{flexDirection:"row",backgroundColor:"#fff",borderRadius:14,paddingHorizontal:12,height:46,alignItems:"center",marginTop:10}, searchInput5D:{flex:1,marginLeft:8,fontSize:13},
  guestBtn5D:{backgroundColor:"#fff",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:6,borderWidth:1.5,borderColor:"#111",borderStyle:"dashed"}, guestBtn5DT:{fontWeight:"800",fontSize:13},
  ruleD5D:{fontSize:11,opacity:0.6,lineHeight:14,marginBottom:8},
  exactResult5D:{borderRadius:20,padding:14,marginBottom:12,borderWidth:2,borderColor:"#111"}, exactTitle:{fontSize:13,fontWeight:"900",color:"#00a651"},
  exactCard5D:{flexDirection:"row",gap:12,marginTop:10,backgroundColor:"#F8F9FA",borderRadius:12,padding:10}, exactImg:{width:60,height:60,borderRadius:10}, exactName:{fontSize:13,fontWeight:"800"}, exactPrice:{fontSize:15,fontWeight:"900",marginTop:4}, exactDetail:{fontSize:10,opacity:0.7,marginTop:4},
  btnPrimary5D:{backgroundColor:"#111",borderRadius:12,paddingVertical:10,paddingHorizontal:14,flex:1,alignItems:"center"}, btnPrimary5DT:{color:"#fff",fontSize:11,fontWeight:"800"},
  btnSecondary5D:{backgroundColor:"#fff",borderRadius:12,paddingVertical:10,paddingHorizontal:14,flex:1,alignItems:"center",borderWidth:1,borderColor:"#E5E8EC"}, btnSecondary5DT:{fontSize:11,fontWeight:"700"},
  cat5D:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:"#fff",marginRight:6,borderWidth:1,borderColor:"#E5E8EC"}, cat5DActive:{backgroundColor:"#111",borderColor:"#111"}, cat5DT:{fontSize:11}, cat5DActiveT:{color:"#fff",fontSize:11,fontWeight:"700"},
  section5D:{fontSize:15,fontWeight:"900",marginTop:14,marginBottom:8},
  card5D:{borderRadius:20,flexDirection:"row",padding:12,marginBottom:10,alignItems:"center"},
  card5DImg:{width:78,height:78,borderRadius:14}, card5DBody:{flex:1,marginLeft:10}, shopRow5D:{flexDirection:"row",alignItems:"center",gap:6}, shopAvatar5D:{width:18,height:18,borderRadius:9}, shopName5D:{fontSize:10,opacity:0.6},
  productName5D:{fontSize:14,fontWeight:"800",marginTop:2}, priceBlock5D:{backgroundColor:"#F8F9FA",borderRadius:10,padding:8,marginTop:6}, productPrice5D:{fontSize:11,fontWeight:"800"}, comPrice5D:{fontSize:10,opacity:0.7,marginTop:2},
  totalPrice5D:{fontSize:11,fontWeight:"900",marginTop:4,backgroundColor:"#111",color:"#fff",padding:4,borderRadius:6,alignSelf:"flex-start"}, lock5D:{backgroundColor:"#FFF3CD",paddingHorizontal:6,paddingVertical:2,borderRadius:8,alignSelf:"flex-start",marginTop:6}, lock5DT:{fontSize:9,fontWeight:"700"},
  favBtn5D:{padding:6}, roleBadge5D:{borderRadius:12,paddingHorizontal:10,paddingVertical:6}, roleBadge5DT:{fontSize:11,fontWeight:"700"},
  card5DLarge:{borderRadius:22,padding:14,marginBottom:12}, cardTitle5D:{fontSize:14,fontWeight:"900"}, settingsLine:{fontSize:15,fontWeight:"800",marginTop:6}, settingsSub:{fontSize:11,opacity:0.6,marginTop:2},
  separationBlock:{backgroundColor:"#F8F9FA",borderRadius:12,padding:10,marginTop:8},
  sepRow:{flexDirection:"row",justifyContent:"space-between",marginBottom:6}, sepLabel:{fontSize:11,opacity:0.7}, sepValue:{fontSize:11,fontWeight:"800"}, sepValueCom:{fontSize:11,fontWeight:"700",color:"#888"}, sepValueLiv:{fontSize:10,fontWeight:"700",color:"#555"},
  sepTotal:{borderTopWidth:1,borderTopColor:"#E5E8EC",paddingTop:6,marginTop:6}, sepLabelTotal:{fontSize:12,fontWeight:"900"}, sepValueTotal:{fontSize:12,fontWeight:"900",backgroundColor:"#111",color:"#fff",paddingHorizontal:8,paddingVertical:3,borderRadius:8},
  grid5D:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:8}, gridItem5D:{width:"48%",height:110,borderRadius:18,overflow:"hidden"}, gridImg5D:{flex:1,justifyContent:"flex-end"}, gridOverlay5D:{backgroundColor:"rgba(0,0,0,0.55)",padding:10}, gridTitle5D:{color:"#fff",fontSize:12,fontWeight:"900"}, gridSub5D:{color:"#fff",fontSize:10,opacity:0.9},
  serviceBanner5D:{height:100,borderRadius:20,overflow:"hidden",marginBottom:12},
  ratingLine5D:{fontSize:12,fontWeight:"800",marginBottom:8},
  detailHero5D:{height:320,borderRadius:24,overflow:"hidden",marginBottom:12}, detailOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.4)",padding:16,justifyContent:"flex-end"}, detailName5D:{color:"#fff",fontSize:22,fontWeight:"900"},
  detailPriceReal5D:{color:"#fff",fontSize:20,fontWeight:"900",marginTop:6,backgroundColor:"rgba(0,0,0,0.5)",paddingHorizontal:10,paddingVertical:4,borderRadius:8,alignSelf:"flex-start"},
  buy5D:{backgroundColor:"#111",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:10}, buy5DT:{color:"#fff",fontWeight:"900",fontSize:13},
  secondary5D:{backgroundColor:"#fff",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:8,borderWidth:1,borderColor:"#E5E8EC"}, secondary5DT:{fontWeight:"700"},
  dangerBtn5D:{backgroundColor:"#FFF0F0",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:8,borderWidth:1,borderColor:"#FFCACA"}, dangerBtn5DT:{fontWeight:"800",color:"#D00"},
  security5D:{backgroundColor:"#E9F0FF",borderRadius:16,padding:12,marginBottom:12,borderWidth:1,borderColor:"#B8D0FF"}, securityTitle5D:{fontSize:12,fontWeight:"900"}, securityText5D:{fontSize:11,marginTop:4,lineHeight:14},
  checkoutImg5D:{width:60,height:60,borderRadius:12}, checkoutTotal5D:{fontSize:12,fontWeight:"900",marginTop:4,backgroundColor:"#111",color:"#fff",padding:4,borderRadius:6,alignSelf:"flex-start"},
  walletHero5D:{height:150,borderRadius:24,overflow:"hidden",marginBottom:12}, walletOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.6)",padding:16,justifyContent:"center"}, walletLabel5D:{color:"#fff",opacity:0.7,fontSize:11}, walletBalance5D:{color:"#fff",fontSize:26,fontWeight:"900",marginTop:4}, walletSub5D:{color:"#fff",fontSize:10,opacity:0.9,marginTop:4},
  input5D:{borderWidth:1,borderColor:"#E5E8EC",borderRadius:12,padding:12,marginTop:8,fontSize:13,backgroundColor:"#fff"},
  history5D:{borderRadius:14,padding:12,flexDirection:"row",alignItems:"center",gap:10,marginBottom:8}, historyIcon5D:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center"}, historyTitle5D:{fontSize:12,fontWeight:"700"}, historyAmount5D:{fontSize:12,fontWeight:"900",marginLeft:"auto"},
  spaceHero5D:{height:120,borderRadius:22,overflow:"hidden",marginBottom:12}, spaceOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",padding:14,justifyContent:"center"}, spaceTitle5D:{color:"#fff",fontSize:18,fontWeight:"900"}, spaceSub5D:{color:"#fff",fontSize:11,opacity:0.9,marginTop:4},
  add5D:{borderRadius:16,flexDirection:"row",alignItems:"center",padding:12,gap:12,marginBottom:12}, addImg5D:{width:48,height:48,borderRadius:12}, addT5D:{fontSize:13,fontWeight:"900"},
  myProd5D:{borderRadius:14,padding:10,flexDirection:"row",gap:10,marginBottom:8,alignItems:"center"}, myProdImg5D:{width:60,height:60,borderRadius:10}, myProdName5D:{fontSize:12,fontWeight:"800"}, myProdPrice5D:{fontSize:11,opacity:0.7,marginTop:2},
  editBtn5D:{backgroundColor:"#F1F3F5",borderRadius:10,paddingHorizontal:10,paddingVertical:8}, editBtn5DT:{fontSize:11,fontWeight:"800"},
  timeline5D:{borderRadius:18,padding:14,marginBottom:12}, timeRow5D:{flexDirection:"row",gap:12,marginBottom:16,alignItems:"center"}, timeCircle5D:{width:28,height:28,borderRadius:14,backgroundColor:"#E9ECEF",alignItems:"center",justifyContent:"center"}, timeActive5D:{backgroundColor:"#111"}, timeTitle5D:{fontSize:12,opacity:0.5,fontWeight:"700"}, timeActiveTitle5D:{opacity:1,color:"#111"},
  delivery5D:{borderRadius:16,padding:12,marginBottom:10}, deliveryTitle5D:{fontSize:12,fontWeight:"800"},
  permutaCard5D:{borderRadius:18,padding:14,marginBottom:10}, permutaRow5D:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12}, permutaImg5D:{width:80,height:80,borderRadius:14}, permutaName5D:{fontSize:13,fontWeight:"800",marginTop:10,textAlign:"center"},
  orderImg5D:{width:50,height:50,borderRadius:10}, fidelity5D:{fontSize:11,opacity:0.7,marginTop:4},
  pageHead5D:{height:56,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, pageTitle5D:{fontSize:14,fontWeight:"900"}, back5D:{width:36,height:36,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3F5",borderRadius:18}, backT5D:{fontSize:20}, home5D:{width:36,height:36,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3F5",borderRadius:18},
  bottom5DWrapper:{position:"absolute",bottom:0,left:0,right:0,alignItems:"center",paddingBottom:8,paddingHorizontal:10}, bottom5DIsland:{flexDirection:"row",backgroundColor:"#111",borderRadius:24,paddingVertical:8,paddingHorizontal:12,gap:4},
  bottomItem5D:{alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:6,borderRadius:16,minWidth:60}, bottomItemActive5D:{backgroundColor:"rgba(255,255,255,0.15)"}, bottomItemSpecial5D:{backgroundColor:"#FFD700",borderRadius:20,transform:[{scale:1.1}]},
  bottomIconWrap5D:{width:36,height:36,borderRadius:18,backgroundColor:"rgba(255,255,255,0.08)",alignItems:"center",justifyContent:"center"}, bottomIconActiveWrap5D:{backgroundColor:"rgba(255,255,255,0.2)"}, bottomIconSpecialWrap5D:{backgroundColor:"#111",width:40,height:40,borderRadius:20},
  bottomIcon5D:{fontSize:18,color:"#fff"}, bottomIconActive5D:{fontSize:20}, bottomIconSpecial5DT:{fontSize:22,color:"#FFD700"},
  badgeCount5D:{position:"absolute",top:-4,right:-6,backgroundColor:"#FF3B30",borderRadius:10,minWidth:18,height:18,alignItems:"center",justifyContent:"center",paddingHorizontal:4,borderWidth:2,borderColor:"#111"}, badgeCountT5D:{color:"#fff",fontSize:9,fontWeight:"900"},
  bottomLabel5D:{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:4,fontWeight:"600"}, bottomLabelActive5D:{color:"#fff",fontWeight:"800"}, activeDot5D:{width:4,height:4,borderRadius:2,backgroundColor:"#FFD700",marginTop:2},
  modalBg5D:{flex:1,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"flex-end"}, modal5D:{backgroundColor:"#fff",borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,paddingBottom:28}, modalTitle5D:{fontSize:16,fontWeight:"900",marginBottom:12},
  empty5D:{backgroundColor:"#fff",borderRadius:18,padding:20,alignItems:"center",marginTop:10},
  roleCard5D:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderRadius:16,padding:12,marginBottom:8,borderWidth:2,borderColor:"#E5E8EC"},
  roleIconWrap5D:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center"},
  roleCard5DTitle:{fontSize:13,fontWeight:"800"}, roleCard5DDesc:{fontSize:11,opacity:0.6,marginTop:2},
  espaceCard5D:{flexDirection:"row",alignItems:"center",borderRadius:18,padding:14,marginBottom:10},
  switchRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:8},
  slotBtn5D:{backgroundColor:"#fff",borderRadius:14,padding:14,marginBottom:8,borderWidth:1,borderColor:"#E5E8EC"}, slotBtnActive5D:{backgroundColor:"#111",borderColor:"#111"}, slotBtnT5D:{fontWeight:"700",fontSize:13},
  msgBubble5D:{borderRadius:14,padding:10,marginBottom:8,maxWidth:"80%"}, msgClient5D:{backgroundColor:"#111",alignSelf:"flex-end"}, msgVendor5D:{backgroundColor:"#F1F3F5",alignSelf:"flex-start"}, msgText5D:{color:"#fff",fontSize:12},
  sendBtn5D:{backgroundColor:"#111",borderRadius:12,width:46,height:46,alignItems:"center",justifyContent:"center",marginTop:8},
});
