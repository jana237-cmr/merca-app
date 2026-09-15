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

const R = { BLOQUE:50, FRAIS_PRODUIT:0.02, FRAIS_SERVICE:0.20, BASE:1500, SPLIT_LIVREUR:600, SPLIT_MARCHAND:450, SPLIT_MERCA:450, BONUS_LIVRAISON:777, POINTS_INSCRIPTION:3000, ARGENT:5000, OR:11000, OR_CYCLE_MOIS:9 };

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
  // Accepte les numéros internationaux (tapés avec leur indicatif, ex: +33...)
  // et garde la compatibilité avec les numéros camerounais tapés sans indicatif
  // (dans ce cas, +237 est ajouté automatiquement).
  const normalizePhone=(raw)=>{
    let p=(raw||"").trim().replace(/[\s-]/g,"");
    if(p.startsWith("00")) p="+"+p.slice(2);
    if(!p.startsWith("+")) p="+237"+p.replace(/^0/,"");
    return p;
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
    if(!regPhone.trim() || regPhone.trim().length<8) return Alert.alert("Erreur","Numéro de téléphone invalide");
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
        setPoints(R.POINTS_INSCRIPTION);
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

  const confirmAddRole=()=>{
    if(!roleModal) return;
    if(!roleExtra.trim()) return Alert.alert("Erreur", `Le champ "${ROLES_INFO[roleModal].champ}" est requis`);
    const extra={};
    if(roleModal==="commercant") extra.shopName=roleExtra.trim();
    if(roleModal==="livreur") extra.vehicule=roleExtra.trim();
    if(roleModal==="pro"){ extra.bureau=roleExtra.trim(); extra.domaine=roleDomaine; }
    setUser(u=>({ ...u, roles:[...new Set([...u.roles, roleModal])], ...extra }));
    setRoleModal(null); setRoleExtra("");
    Alert.alert("Rôle activé", `Espace ${ROLES_INFO[roleModal].label} disponible - SIMULATION`);
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
    const isDelivery = delivery==="Livraison MERCA";
    const com=Math.round(product.price*R.FRAIS_PRODUIT);
    const tot=product.price + (isDelivery? R.BASE + com : 0);
    if(wallet<tot) return Alert.alert("Solde insuffisant","");
    if(product.stock<=0) return Alert.alert("Rupture de stock","");
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
    confirm(`Confirmer réception - Code ${order.codeLivraison}`,`Débloque les fonds vers le commerçant/livreur - +${R.BONUS_LIVRAISON} pts`,async()=>{
      if(!accessToken) return;
      try{
        const updated = await apiConfirmOrder(accessToken, order.id);
        const u = serverToLocalOrder(updated);
        setOrders(os=>os.map(o=>o.id===order.id?u:o)); setSelectedOrder(u);
        setPoints(p=>{ const np=p+R.BONUS_LIVRAISON; if(np>=R.OR && !orDate) setOrDate(Date.now()); return np; });
        Alert.alert("Confirmé !",`+${R.BONUS_LIVRAISON} pts - Code ${order.codeLivraison}`);
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
    const com=Math.round(selectedService.price*R.FRAIS_SERVICE); const tot=selectedService.price+com;
    if(wallet<tot) return Alert.alert("Solde insuffisant","");
    try{
      const created = await apiCreateBooking(accessToken, { serviceId:selectedService.id, proId:selectedService.proId, servicePrice:selectedService.price, slotAt:new Date(selectedSlot.at).toISOString(), idempotencyKey:uid("idem") });
      const b = serverToLocalBooking(created);
      setBookings(bs=>[b,...bs]);
      await refreshWalletBalance();
      setWalletHistory(h=>[{id:uid("h"),type:`Réservation ${selectedService.name} - Code ${b.bookingCode}`,amount:-b.total,icon:"📅",color:"#111"},...h]);
      setSelectedBooking(b); setSelectedSlot(null); nav("bookingTracking");
    }catch(e){ Alert.alert("Erreur", e.message); }
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

  // ---- Support (messages + litige) ----
  const threadMessages=(threadId)=> messages.filter(m=>m.threadId===threadId);
  const sendMessage=()=>{
    if(!messageInput.trim() || !supportThread) return;
    setMessages(ms=>[...ms,{ id:uid("msg"), threadId:supportThread, from:"client", text:messageInput.trim(), at:Date.now() }]);
    setMessageInput("");
  };
  const submitDispute=()=>{
    if(!disputeDesc.trim()) return Alert.alert("Erreur","Décris le problème");
    setDisputes(ds=>[{ id:uid("d"), threadId:supportThread, reason:disputeReason, description:disputeDesc.trim(), status:"Ouvert", createdAt:Date.now() },...ds]);
    setShowDisputeForm(false); setDisputeDesc("");
    Alert.alert("Réclamation envoyée","SIMULATION TEST - en cours de traitement");
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
            <TextInput value={regPhone} onChangeText={setRegPhone} placeholder={t("phone_placeholder")} keyboardType="phone-pad" style={styles.input5D}/>
          </View>
          ) : (
          <>
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>{t("create_account_title")}</Text>
            <TextInput value={regName} onChangeText={setRegName} placeholder={t("name_placeholder")} style={styles.input5D}/>
            <TextInput value={regPhone} onChangeText={setRegPhone} placeholder={t("phone_placeholder")} keyboardType="phone-pad" style={styles.input5D}/>
            <TextInput value={regCity} onChangeText={setRegCity} placeholder={t("city_placeholder")} style={styles.input5D}/>
            <TextInput value={regReferralCode} onChangeText={(v)=>{ setRegReferralCode(v); setReferralAutoFilled(false); }} placeholder={lang==="fr"?"Code de parrainage (facultatif)":"Referral code (optional)"} autoCapitalize="characters" style={styles.input5D}/>
            {referralAutoFilled && <Text style={{fontSize:11,color:"#00a651",marginTop:4,fontWeight:"700"}}>{lang==="fr"?"✅ Code détecté automatiquement":"✅ Code auto-detected"}</Text>}
          </View>

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
            <View><Text style={[styles.logo5D,{color:T.text}]}>MERCA</Text><Text style={styles.logoSub5D}>{user.guest?"Mode Invité":`Bonjour ${user.name.split(" ")[0]}`} • {getLevel()} {!user.guest&&`${points}pts`}</Text></View>
          </View>
          <TouchableOpacity style={styles.badge5D} onPress={()=>nav("settings")}><Text style={styles.badge5DT}>⚙️</Text></TouchableOpacity>
        </View>
        <Banner color={BANNERS.home.color} icon={BANNERS.home.icon} style={styles.hero5D} radius={24}>
          <View style={styles.hero5DOverlay}>
            <Text style={styles.hero5DTitle}>Yaoundé - Prix réel d'abord</Text>
            <Text style={styles.hero5DSub}>SIMULATION TEST - {R.SPLIT_LIVREUR}/{R.SPLIT_MARCHAND}/{R.SPLIT_MERCA}</Text>
            <View style={styles.search5D}><Text>🔎</Text><TextInput value={search} onChangeText={(t)=>{ setSearch(t); setShowAlternatives(false); }} placeholder="Tape produit exact..." placeholderTextColor="#999" style={styles.searchInput5D}/></View>
          </View>
        </Banner>
        {debouncedSearch!=='' && filteredExact.length>0 && !showAlternatives && (
          <View style={[styles.exactResult5D,{backgroundColor:T.card}]}>
            <Text style={styles.exactTitle}>✅ Produit trouvé - Prix réel d'abord</Text>
            {filteredExact.slice(0,1).map(p=>{ const com=Math.round(p.price*R.FRAIS_PRODUIT); return (
              <View key={p.id} style={styles.exactCard5D}><Image source={{uri:p.img}} style={styles.exactImg}/><View style={{flex:1}}><Text style={styles.exactName}>{p.name}</Text><Text style={styles.exactPrice}>{money(p.price)} PRIX RÉEL</Text><Text style={styles.exactDetail}>Produit {money(p.price)} + 2% {money(com)} + Liv {R.BASE}F</Text></View></View>
            );})}
            <View style={{flexDirection:'row',gap:8,marginTop:10}}>
              <TouchableOpacity style={styles.btnPrimary5D} onPress={()=>{ setSelected(filteredExact[0]); nav("product"); }}><Text style={styles.btnPrimary5DT}>Voir produit</Text></TouchableOpacity>
              {!user.guest && <TouchableOpacity style={styles.btnSecondary5D} onPress={()=>setShowAlternatives(true)}><Text style={styles.btnSecondary5DT}>Alternatives</Text></TouchableOpacity>}
            </View>
          </View>
        )}
        {user.guest && debouncedSearch==='' && (
          <View style={styles.security5D}><Text style={styles.securityText5D}>🔒 Mode invité : tape le nom exact d'un produit pour le trouver. La navigation par catégories et les alternatives sont réservées aux comptes inscrits.</Text></View>
        )}
        {!user.guest && (debouncedSearch==='' || showAlternatives) && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:12}}>{CATS.map(c=><TouchableOpacity key={c} style={[styles.cat5D,cat===c&&styles.cat5DActive]} onPress={()=>setCat(c)}><Text style={cat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={[styles.section5D,{color:T.text}]}>✨ Catalogue</Text>
          </>
        )}
      </View>
    );
    const ListFooter = (
      <View>
        <TouchableOpacity style={styles.serviceBanner5D} onPress={()=>nav("services")}>
          <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧑‍💼 SERVICES PRO</Text><Text style={styles.gridSub5D}>Juridique, beauté, réparation, éducation...</Text></View></Banner>
        </TouchableOpacity>
        <View style={styles.grid5D}>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("client")}><Banner color={BANNERS.client.color} icon={BANNERS.client.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>👤 CLIENT</Text><Text style={styles.gridSub5D}>{user.guest?"Invité":`${points}pts`}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("espaces")}><Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧰 ESPACE</Text><Text style={styles.gridSub5D}>Vendre / Livrer</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>user.guest?requireAccount("accéder à PERMUTA"):nav("permuta")}><Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🔄 PERMUTA {user.guest?"🔒":""}</Text><Text style={styles.gridSub5D}>Simulation test</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>user.guest?requireAccount("accéder à MERCA CERCLE"):nav("circle")}><Banner color="#F5A623" icon="🎁" style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🎁 CERCLE {user.guest?"🔒":""}</Text><Text style={styles.gridSub5D}>Parrainage</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("settings")}><Banner color={BANNERS.settings.color} icon={BANNERS.settings.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>⚙️ PARAMÈTRES</Text><Text style={styles.gridSub5D}>Compte, rôles, PIN</Text></View></Banner></TouchableOpacity>
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
              <Text style={styles.productPrice5D}>Produit: {money(p.price)} PRIX RÉEL</Text>
              <Text style={styles.comPrice5D}>Com 2% = {money(com)}</Text>
              <Text style={styles.totalPrice5D}>Total {money(tot)}</Text>
            </View>
            {p.stock<=0 && <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ Rupture de stock</Text></View>}
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
      <ImageBackground source={{uri:selected.img}} style={styles.detailHero5D} imageStyle={{borderRadius:24}}><View style={styles.detailOverlay5D}><Text style={styles.detailName5D}>{selected.name}</Text><Text style={styles.detailPriceReal5D}>{money(selected.price)} PRIX RÉEL</Text></View></ImageBackground>
      {rating && <Text style={styles.ratingLine5D}>⭐ {rating.avg}/5 ({rating.count} avis) — {selected.shop}</Text>}
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <View style={styles.separationBlock}>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>Produit</Text><Text style={styles.sepValue}>{money(selected.price)}</Text></View>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>Livraison {R.BASE}F</Text><Text style={styles.sepValueLiv}>{R.SPLIT_LIVREUR}+{R.SPLIT_MARCHAND}+{R.SPLIT_MERCA}</Text></View>
          <View style={[styles.sepRow,styles.sepTotal]}><Text style={styles.sepLabelTotal}>Total</Text><Text style={styles.sepValueTotal}>{money(tot)}</Text></View>
        </View>
      </View>
      {selected.stock>0 ? <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("commander"):nav("checkout")}><Text style={styles.buy5DT}>Commander - SIMULATION</Text></TouchableOpacity> : <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ Rupture de stock</Text></View>}
    </Page>);
  }

  if(page==="checkout"){
    const com=selected?Math.round(selected.price*R.FRAIS_PRODUIT):0; const tot=selected?selected.price+R.BASE+com:0;
    return (<Page title="Checkout" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={styles.security5D}><Text style={styles.securityTitle5D}>🧪 SIMULATION TEST</Text><Text style={styles.securityText5D}>Escrow simulé - fonds bloqués jusqu'à confirmation</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selected?.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selected?.name}</Text><Text style={styles.checkoutTotal5D}>Total {money(tot)}</Text></View></View></View>
      <TouchableOpacity style={styles.buy5D} onPress={()=>confirm("Confirmer",`Payer ${money(tot)} ?`,()=>createOrder(selected,"Livraison MERCA"))}><Text style={styles.buy5DT}>🚚 Livraison {money(tot)}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary5D} onPress={()=>confirm("Retrait",`Retrait ${money(selected.price)} ?`,()=>createOrder(selected,"Retrait boutique"))}><Text style={styles.secondary5DT}>🏪 Retrait boutique</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="wallet"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"💳",label:"Wallet",desc:"Le portefeuille est réservé aux comptes inscrits"}} onActivate={()=>setUser(null)} actionLabel="S'inscrire"/>;
    return (<Page title="Wallet" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.wallet.color} icon={BANNERS.wallet.icon} style={styles.walletHero5D} radius={24}><View style={styles.walletOverlay5D}><Text style={styles.walletLabel5D}>SIMULATION TEST</Text><Text style={styles.walletBalance5D}>{money(wallet)}</Text><Text style={styles.walletSub5D}>{points}pts • {getLevel()}</Text></View></Banner>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🔐 Déverrouiller (PIN)</Text>
        <TextInput value={pinInput} onChangeText={setPinInput} placeholder="PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={async()=>{
          if(Date.now()<blocked) return Alert.alert("Bloqué","Réessaie plus tard (simulation)");
          const h=await hashPin(pinInput);
          if(h!==walletPin){ const f=fails+1; if(f>=3){ setBlocked(Date.now()+300000); setFails(0); Alert.alert("Bloqué 5min"); } else { setFails(f); Alert.alert(`Reste ${3-f} essai(s)`); } return; }
          setFails(0); setPinInput(""); Alert.alert("Débloqué - SIMULATION");
        }}><Text style={styles.buy5DT}>Débloquer</Text></TouchableOpacity>
      </View>
      {walletHistory.map(h=>(<View key={h.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={[styles.historyIcon5D,{backgroundColor:h.color+"20"}]}><Text>{h.icon}</Text></View><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{h.type}</Text></View><Text style={[styles.historyAmount5D,{color:h.color}]}>{h.amount!==0?money(h.amount):''}</Text></View>))}
    </Page>);
  }

  // ---- Espace pro (choix boutique/livraison/bureau) ----
  if(page==="espaces"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🧰",label:"Espace",desc:"Vendre ou livrer nécessite un compte inscrit"}} onActivate={()=>setUser(null)} actionLabel="S'inscrire"/>;
    return (<Page title="Mon Espace" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Text style={styles.ruleD5D}>Un espace grisé veut dire que ce rôle n'est pas encore activé — active-le depuis les Paramètres.</Text>
      <EspaceCard T={T} active={hasRole("commercant")} icon={ROLES_INFO.commercant.icon} color={ROLES_INFO.commercant.color} title="Boutique (Commerçant)" desc="Vendre des produits" onPress={()=>hasRole("commercant")?nav("merchant"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("livreur")} icon={ROLES_INFO.livreur.icon} color={ROLES_INFO.livreur.color} title="Livraison" desc={`${R.SPLIT_LIVREUR}F + ${R.BONUS_LIVRAISON}pts`} onPress={()=>hasRole("livreur")?nav("courier"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("pro")} icon={ROLES_INFO.pro.icon} color={ROLES_INFO.pro.color} title="Bureau Pro" desc="Vendre un service" onPress={()=>hasRole("pro")?nav("pro"):nav("settings")}/>
    </Page>);
  }

  if(page==="merchant"){
    if(!hasRole("commercant")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.commercant} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    const my=products.filter(p=>p.shop===user.shopName); const rating=getRating(user.id);
    return (<Page title={`Boutique - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🏪 {user.shopName} {isVerified("commercant")?"✅":""}</Text><Text style={styles.spaceSub5D}>{rating?`⭐ ${rating.avg}/5 (${rating.count} avis)`:"Pas encore d'avis"}</Text></View></Banner>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAdd(true)}><Image source={{uri:IMG.boutique}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>＋ Ajouter produit</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>📈 Publicité Facebook/Instagram</Text><Text style={styles.securityText5D}>Appuie sur "📤 Partager" sur un produit, puis dans Facebook/Instagram, choisis "Booster cette publication" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).</Text></View>
      {my.map(p=>{ const bloq=Date.now()-p.last<R.BLOQUE*86400000; return (
        <View key={p.id} style={[styles.myProd5D,{backgroundColor:T.card}]}><Image source={{uri:p.img}} style={styles.myProdImg5D}/><View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{p.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>Prix {money(p.price)} • Stock {p.stock}</Text></View><TouchableOpacity onPress={()=>shareProduct(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>📤 Partager</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEdit(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>✏️ Modifier</Text></TouchableOpacity></View>
      );})}

      <Text style={[styles.section5D,{color:T.text}]}>📦 Commandes reçues</Text>
      {incomingOrders.length===0 && <Text style={styles.settingsSub}>Aucune commande pour le moment.</Text>}
      {incomingOrders.map(o=>(
        <View key={o.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text><Text style={styles.myProdPrice5D}>{o.status} • {money(o.total)}</Text></View>
          {o.step<=1 && <TouchableOpacity onPress={()=>doAdvance(o, refreshIncomingOrders)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>➜ Étape suivante</Text></TouchableOpacity>}
        </View>
      ))}
      <Modal visible={showAdd} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>＋ Nouveau produit</Text>
        <TextInput value={npName} onChangeText={setNpName} placeholder="Nom" style={styles.input5D}/>
        <TextInput value={npPrice} onChangeText={setNpPrice} placeholder="Prix (FCFA)" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={npStock} onChangeText={setNpStock} placeholder="Stock" keyboardType="numeric" style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{CATS.filter(c=>c!=="Tous").map(c=><TouchableOpacity key={c} style={[styles.cat5D,npCat===c&&styles.cat5DActive]} onPress={()=>setNpCat(c)}><Text style={npCat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createProd}><Text style={styles.buy5DT}>Publier</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAdd(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEdit} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>✏️ Modifier {showEdit?.name}</Text>
        <TextInput value={editPrice} onChangeText={setEditPrice} placeholder="Nouveau prix" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={editStock} onChangeText={setEditStock} placeholder="Nouveau stock" keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateProd}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEdit(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  // ---- Parcourir les services (client) ----
  if(page==="services"){
    return (<Page title="Services Pro" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🧑‍💼 Tous les services disponibles</Text></View></Banner>
      {dispoServices.length===0 && <View style={styles.empty5D}><Text>Aucun service publié pour l'instant</Text></View>}
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
      <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("réserver ce service"):nav("bookingSlot")}><Text style={styles.buy5DT}>Réserver - SIMULATION</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingSlot" && selectedService){
    const slots=genSlots(); const com=Math.round(selectedService.price*R.FRAIS_SERVICE); const tot=selectedService.price+com;
    return (<Page title="Choisir un créneau" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedService.name}</Text><Text style={styles.checkoutTotal5D}>Total {money(tot)}</Text></View>
      {slots.map(s=>(<TouchableOpacity key={s.id} style={[styles.slotBtn5D, selectedSlot?.id===s.id&&styles.slotBtnActive5D]} onPress={()=>setSelectedSlot(s)}><Text style={[styles.slotBtnT5D, selectedSlot?.id===s.id&&{color:"#fff"}]}>📅 {s.label}</Text></TouchableOpacity>))}
      <TouchableOpacity style={[styles.buy5D,!selectedSlot&&{opacity:0.4}]} disabled={!selectedSlot} onPress={()=>confirm("Confirmer la réservation",`Payer ${money(tot)} pour le créneau ${selectedSlot?.label} ?`,createBooking)}><Text style={styles.buy5DT}>Confirmer et payer</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingTracking"){
    return (<Page title="Ma réservation" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedBooking ? <View style={styles.empty5D}><Text>Aucune réservation</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedBooking.service.name} - Code {selectedBooking.bookingCode}</Text>
          <Text style={styles.settingsSub}>{selectedBooking.slot.label} • {money(selectedBooking.total)}</Text>
        </View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{BOOKING_STEPS.map((s,i)=>{ const act=i<=selectedBooking.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedBooking.step<2 && <TouchableOpacity style={styles.secondary5D} onPress={()=>cancelBooking(selectedBooking)}><Text style={styles.secondary5DT}>Annuler la réservation</Text></TouchableOpacity>}
        {selectedBooking.step===2 && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedBooking.proId, undefined, selectedBooking.id)}><Text style={styles.buy5DT}>⭐ Laisser un avis</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedBooking.id); nav("support"); }}><Text style={styles.secondary5DT}>💬 Support / Signaler un problème</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview}/>
    </Page>);
  }

  // ---- Bureau Pro ----
  if(page==="pro"){
    if(!hasRole("pro")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.pro} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    const my=services.filter(s=>s.proId===user.id); const rating=getRating(user.id);
    return (<Page title={`Bureau Pro - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.pro.color} icon={BANNERS.pro.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🧑‍💼 {user.bureau} {isVerified("pro")?"✅":""}</Text><Text style={styles.spaceSub5D}>{user.domaine} • {rating?`⭐ ${rating.avg}/5 (${rating.count} avis)`:"Pas encore d'avis"}</Text></View></Banner>

      {incomingBookings.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>📅 Mes réservations</Text>
        {incomingBookings.map(b=>(<View key={b.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{b.service.name} - {b.slot.label}</Text><Text style={styles.myProdPrice5D}>Code {b.bookingCode} • {b.status}</Text></View>
          {b.status==="Demande envoyée" && <TouchableOpacity onPress={()=>proConfirmBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>Confirmer</Text></TouchableOpacity>}
          {b.status==="Confirmée" && <TouchableOpacity onPress={()=>proCompleteBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>Terminer</Text></TouchableOpacity>}
        </View>))}
      </>)}

      <Text style={[styles.section5D,{color:T.text}]}>Mes services</Text>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAddService(true)}><Image source={{uri:IMG.bureau}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>＋ Ajouter un service</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>📈 Publicité Facebook/Instagram</Text><Text style={styles.securityText5D}>Appuie sur "📤 Partager" sur un service, puis dans Facebook/Instagram, choisis "Booster cette publication" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).</Text></View>
      {my.map(s=>{ const bloq=Date.now()-s.last<R.BLOQUE*86400000; return (
        <View key={s.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <Image source={{uri:IMG.bureau}} style={styles.myProdImg5D}/>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{s.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>{s.domaine} • Tarif {money(s.price)} • {s.dispo?"✅ Disponible":"⏸ Indisponible"}</Text></View>
          <View style={{gap:6}}><TouchableOpacity onPress={()=>shareService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>📤 Partager</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEditService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>✏️ Tarif</Text></TouchableOpacity><TouchableOpacity onPress={()=>toggleDispo(s.id)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{s.dispo?"⏸ Pause":"▶️ Activer"}</Text></TouchableOpacity></View>
        </View>
      );})}
      <Modal visible={showAddService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>＋ Nouveau service</Text>
        <TextInput value={nsName} onChangeText={setNsName} placeholder="Nom du service" style={styles.input5D}/>
        <TextInput value={nsPrice} onChangeText={setNsPrice} placeholder="Tarif (FCFA)" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={nsDesc} onChangeText={setNsDesc} placeholder="Description courte" style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,nsDomaine===d&&styles.cat5DActive]} onPress={()=>setNsDomaine(d)}><Text style={nsDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createService}><Text style={styles.buy5DT}>Publier</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAddService(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEditService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>✏️ Modifier tarif</Text>
        <TextInput value={esPrice} onChangeText={setEsPrice} placeholder="Nouveau tarif" keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateService}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEditService(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="tracking"){
    return (<Page title="Suivi" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedOrder ? <View style={styles.empty5D}><Text>Aucune commande</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selectedOrder.product.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedOrder.product.name} - Code {selectedOrder.codeLivraison}</Text><Text style={styles.checkoutTotal5D}>Total {money(selectedOrder.total)}</Text></View></View></View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{STEPS.map((s,i)=>{ const act=i<=selectedOrder.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedOrder.step<4 && <Text style={[styles.settingsSub,{textAlign:"center",marginTop:8}]}>⏳ En attente du commerçant/livreur pour la prochaine étape</Text>}
        {selectedOrder.step===4 && selectedOrder.status!=="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>confirmReception(selectedOrder)}><Text style={styles.buy5DT}>✅ Confirmer réception</Text></TouchableOpacity>}
        {selectedOrder.status==="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedOrder.merchantId, selectedOrder.id, undefined)}><Text style={styles.buy5DT}>⭐ Laisser un avis</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedOrder.id); nav("support"); }}><Text style={styles.secondary5DT}>💬 Support / Signaler un problème</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview}/>
    </Page>);
  }

  // ---- Support (messagerie + litige), commun aux commandes et réservations ----
  if(page==="support"){
    const msgs=threadMessages(supportThread);
    return (<Page title="Support" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card,maxHeight:300}]}>
        {msgs.length===0 && <Text style={styles.settingsSub}>Aucun message. Écris ici en cas de question sur cette commande/réservation.</Text>}
        {msgs.map(m=>(<View key={m.id} style={[styles.msgBubble5D, m.from==="client"?styles.msgClient5D:styles.msgVendor5D]}><Text style={[styles.msgText5D, m.from!=="client"&&{color:"#111"}]}>{m.text}</Text></View>))}
      </View>
      <View style={{flexDirection:"row",gap:8}}>
        <TextInput value={messageInput} onChangeText={setMessageInput} placeholder="Écrire un message..." style={[styles.input5D,{flex:1,marginTop:0}]}/>
        <TouchableOpacity style={styles.sendBtn5D} onPress={sendMessage}><Text style={{color:"#fff",fontWeight:"800"}}>➤</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dangerBtn5D} onPress={()=>setShowDisputeForm(true)}><Text style={styles.dangerBtn5DT}>⚠️ Signaler un problème</Text></TouchableOpacity>
      {disputes.filter(d=>d.threadId===supportThread).map(d=>(<View key={d.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{d.reason}</Text><Text style={styles.settingsSub}>{d.description}</Text></View><Text style={styles.roleBadge5DT}>{d.status}</Text></View>))}
      <Modal visible={showDisputeForm} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>⚠️ Signaler un problème</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{DISPUTE_REASONS.map(r=><TouchableOpacity key={r} style={[styles.cat5D,disputeReason===r&&styles.cat5DActive]} onPress={()=>setDisputeReason(r)}><Text style={disputeReason===r?styles.cat5DActiveT:styles.cat5DT}>{r}</Text></TouchableOpacity>)}</ScrollView>
        <TextInput value={disputeDesc} onChangeText={setDisputeDesc} placeholder="Décris le problème" multiline style={[styles.input5D,{height:80}]}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitDispute}><Text style={styles.buy5DT}>Envoyer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowDisputeForm(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="client"){
    const favProducts = products.filter(p=>favorites.includes(p.id));
    return (<Page title={`Client - ${points}pts`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.spaceHero5D,{alignItems:"center",justifyContent:"center"}]}><Avatar user={user} size={72}/><Text style={[styles.spaceTitle5D,{color:"#111",marginTop:8}]}>{user.name}</Text><Text style={{color:"#555",fontSize:11}}>{user.city} • {user.phone}</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>Rôles actifs</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8}}>{user.roles.map(r=>(<RoleBadge key={r} info={ROLES_INFO[r]} verified={isVerified(r)}/>))}</View>
      </View>
      {favProducts.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>❤️ Mes favoris</Text>
        {favProducts.map(p=>(<TouchableOpacity key={p.id} style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelected(p); nav("product"); }}><Image source={{uri:p.img}} style={styles.card5DImg}/><View style={styles.card5DBody}><Text style={[styles.productName5D,{color:T.text}]}>{p.name}</Text><Text style={styles.productPrice5D}>{money(p.price)}</Text></View></TouchableOpacity>))}
      </>)}
      <Text style={[styles.section5D,{color:T.text}]}>📦 Mes commandes</Text>
      <FlatList data={orders} keyExtractor={(o)=>o.id} scrollEnabled={false} renderItem={({item:o})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedOrder(o); nav("tracking"); }}><View style={{flexDirection:'row',gap:10}}><Image source={{uri:o.product.img}} style={styles.orderImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text></View></View></TouchableOpacity>)}/>
      <Text style={[styles.section5D,{color:T.text}]}>📅 Mes réservations</Text>
      <FlatList data={bookings} keyExtractor={(b)=>b.id} scrollEnabled={false} renderItem={({item:b})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedBooking(b); nav("bookingTracking"); }}><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{b.service.name} • Code {b.bookingCode}</Text><Text style={styles.settingsSub}>{b.status}</Text></View></TouchableOpacity>)}/>
    </Page>);
  }

  if(page==="courier"){
    if(!hasRole("livreur")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.livreur} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    return (<Page title={`Livreur - ${R.SPLIT_LIVREUR}F`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.courier.color} icon={BANNERS.courier.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🚚 {user.vehicule} {isVerified("livreur")?"✅":""}</Text><Text style={styles.spaceSub5D}>{R.SPLIT_LIVREUR}F + {R.BONUS_LIVRAISON}pts par livraison confirmée</Text></View></Banner>
      <Text style={[styles.section5D,{color:T.text}]}>📦 Livraisons disponibles</Text>
      {availableDeliveries.length===0 && <Text style={styles.settingsSub}>Aucune livraison disponible pour l'instant.</Text>}
      {availableDeliveries.map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, async()=>{ await refreshAvailableDeliveries(); await refreshMyDeliveries(); })}><Text style={styles.buy5DT}>Prendre - {R.SPLIT_LIVREUR}F</Text></TouchableOpacity></View>))}
      <Text style={[styles.section5D,{color:T.text}]}>🚚 Mes livraisons en cours</Text>
      {myDeliveries.filter(o=>o.step<4).length===0 && <Text style={styles.settingsSub}>Aucune livraison en cours.</Text>}
      {myDeliveries.filter(o=>o.step<4).map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><Text style={styles.settingsSub}>{o.status}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, refreshMyDeliveries)}><Text style={styles.buy5DT}>✅ Marquer livrée</Text></TouchableOpacity></View>))}
    </Page>);
  }

  if(page==="permuta"){
    return (<Page title="PERMUTA" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🔄 PERMUTA - SIMULATION TEST</Text></View></Banner>
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
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🎁",label:"MERCA CERCLE",color:"#F5A623",desc:"Le parrainage est réservé aux comptes inscrits"}} onActivate={()=>setUser(null)} actionLabel="S'inscrire"/>;
    return (<Page title="🎁 MERCA CERCLE" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:"#F5A623"}]}>
        <Text style={{color:"#fff",fontWeight:"900",fontSize:14}}>Ton code personnel</Text>
        <Text style={{color:"#fff",fontWeight:"900",fontSize:32,letterSpacing:4,marginTop:8}}>{circleData?.code||"..."}</Text>
        <Text style={{color:"rgba(255,255,255,0.85)",fontSize:11,marginTop:8}}>Invite tes proches - quand ils font leur première vraie commande ou réservation confirmée, tu reçois {money(500)}.</Text>
      </View>
      <TouchableOpacity style={styles.buy5D} onPress={shareCircleCode}><Text style={styles.buy5DT}>📤 Partager mon code</Text></TouchableOpacity>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>📊 Mon Cercle</Text>
        <Text style={[styles.settingsLine,{color:T.text}]}>{circleData?.invitedCount||0} personne(s) invitée(s)</Text>
        <Text style={styles.settingsSub}>{circleData?.activeCount||0} devenue(s) active(s) (première transaction confirmée)</Text>
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
        <Text style={[styles.cardTitle5D,{color:T.text}]}>👤 Mon compte</Text>
        <Text style={[styles.settingsLine,{color:T.text}]}>{user.name}</Text>
        <Text style={styles.settingsSub}>{user.phone||"Pas de numéro (invité)"} • {user.city}</Text>
        {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={openAccountEdit}><Text style={styles.secondary5DT}>Modifier mes informations</Text></TouchableOpacity>}
        {user.guest && <TouchableOpacity style={styles.buy5D} onPress={()=>setUser(null)}><Text style={styles.buy5DT}>Créer un compte complet</Text></TouchableOpacity>}
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
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🎨 Apparence</Text>
        <View style={styles.switchRow}><Text style={{color:T.text}}>Mode sombre</Text><Switch value={dark} onValueChange={setDark}/></View>
        <View style={styles.switchRow}><Text style={{color:T.text}}>Notifications (simulation)</Text><Switch value={notifEnabled} onValueChange={setNotifEnabled}/></View>
      </View>

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>ℹ️ À propos</Text>
        <Text style={styles.settingsSub}>MERCA V7 - SIMULATION TEST - Pas bancaire réel, pas de vrai SMS</Text>
        <Text style={styles.settingsSub}>L'icône de l'app sur ton téléphone (écran d'accueil) ne peut pas être remplacée par une photo libre depuis l'app elle-même — c'est une restriction d'iOS et Android, pas une limite de MERCA. Ta photo de profil ci-dessus fonctionne partout dans l'app.</Text>
      </View>

      {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={logout}><Text style={styles.secondary5DT}>🚪 Déconnexion</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.dangerBtn5D} onPress={resetAllData}><Text style={styles.dangerBtn5DT}>🗑 Réinitialiser toutes les données</Text></TouchableOpacity>

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

function ReviewModal({visible,rating,setRating,comment,setComment,onCancel,onSubmit}){
  return (<Modal visible={visible} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
    <Text style={styles.modalTitle5D}>⭐ Laisser un avis</Text>
    <View style={{flexDirection:"row",justifyContent:"center",gap:8,marginVertical:12}}>
      {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n} onPress={()=>setRating(n)}><Text style={{fontSize:30}}>{n<=rating?"⭐":"☆"}</Text></TouchableOpacity>))}
    </View>
    <TextInput value={comment} onChangeText={setComment} placeholder="Un commentaire (facultatif)" multiline style={[styles.input5D,{height:70}]}/>
    <TouchableOpacity style={styles.buy5D} onPress={onSubmit}><Text style={styles.buy5DT}>Envoyer mon avis</Text></TouchableOpacity>
    <TouchableOpacity style={styles.secondary5D} onPress={onCancel}><Text>Annuler</Text></TouchableOpacity>
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
