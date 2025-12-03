1. Missie van de package

Doel:
Bouw een NPM-package @automatiseerjouwproces/identity-kit die:

Een standaard loginflow biedt voor Next.js-projecten.

In v1 alleen Azure AD / Entra ID ondersteunt.

Zoveel mogelijk auth-logica in de package stopt.

Een kant-en-klare loginpagina exporteert als React-component.

Makkelijk uitbreidbaar is naar andere identity providers.

Niet doen in deze package:

Geen generiek UI-systeem of theming-framework; alleen een nette, basic loginpagina.

Geen user-menu, profielpagina’s of uitgebreide layout: die komen in een andere UI-package.

2. Randvoorwaarden & aannames

De agent mag van het volgende uitgaan:

Doelomgeving

Next.js 13+ met App Router is de primaire focus.

Ondersteuning voor Pages Router mag later komen, maar is geen hard requirement voor v1.

Taal & tooling

TypeScript.

Package-build met een moderne bundler (bijv. tsup, rollup of equivalent).

ESM + CJS output waar nodig.

Auth-model

OAuth2/OIDC met Azure AD (Entra ID).

Login via Authorization Code Flow met PKCE.

Tokens nooit in localStorage, alleen in secure cookies / server-side sessie.

Sessiestrategie (v1)

JWT in een HTTP-only, secure cookie (stateless sessies) voor eenvoud.

JWT bevat basisclaims over de gebruiker (sub, name, email, roles).

Doelgebruikers van de package

Interne developers van Automatiseer Jouw Proces.

Ze werken in Next.js en willen zo min mogelijk auth-complexiteit in hun eigen app.

3. Hoge-lijn architectuur

De agent moet de package opbouwen rond deze drie lagen:

Core Auth Layer (framework-onafhankelijk)

Provider-abstractie (Azure nu, andere later).

Tokenvalidatie, sessie-JWT genereren/valideren.

Mapping van provider-claims naar een gestandaardiseerde User.

Next.js Integration Layer

Helpers voor:

Route handlers: /api/auth/login, /api/auth/callback, /api/auth/logout.

Server utilities: getServerUser, requireAuth.

Eventueel een middleware helper.

React Layer

<IdentityProvider> component dat de auth-context levert.

useIdentity() hook voor toegang tot user, status, login, logout.

<LoginPage> component als kant-en-klare loginpagina.

4. Structuur van het project (package)

De agent maakt een mapstructuur zoals:

src/

core/

types.ts

authConfig.ts

authProvider.ts

azureProvider.ts

jwtSession.ts

next/

handlers/ (login, callback, logout helpers)

server/ (SSR helpers)

middleware/ (auth middleware helper)

react/

IdentityContext.tsx

IdentityProvider.tsx

useIdentity.ts

LoginPage.tsx

index.ts (publieke exports)

Exacte bestandsnamen mogen variëren, zolang de logische lagen gelijk blijven.

5. Detailplan per fase
Fase 1 – Types & Configuratiemodel definiëren

Doel: Een stabiele basis van types en config waarop de rest voortbouwt.

Taken:

Definieer het User-type:

Minimale velden:

id: string

name: string | null

email: string | null

Optionele velden:

roles?: string[]

groups?: string[]

Maak ruimte voor extensie via generics (optioneel), maar houd v1 simpel.

Definieer AuthStatus type:

"authenticated" | "unauthenticated" | "loading".

Definieer ProviderName:

"azure" (later uitbreidbaar met "oidc", "google", etc.).

Definieer AuthConfig:

Bovenlaag:

provider: "azure"

postLoginRedirectPath: string (bijv. "/")

Azure-specifiek deel:

tenantId: string

clientId: string

clientSecret: string

redirectUri: string (bijv. https://app.domein.nl/api/auth/callback)

scopes?: string[] (default bijv. ["openid", "profile", "email"])

Maak een helper createAuthConfig(config: AuthConfigInput):

Voert basisvalidatie uit (velden aanwezig?).

Verrijkt met defaults (scopes, postLoginRedirect).

Definition of Done:

Types zijn gedefinieerd in core/types.ts en/of core/authConfig.ts.

AuthConfig kan worden aangemaakt vanuit env-variabelen zonder type errors.

Geen bundler-specifieke code nodig in deze fase.

Fase 2 – Auth Provider abstractie + Azure implementatie

Doel: Een generieke provider-interface en de v1-implementatie voor Azure.

Taken:

Definieer een AuthProvider interface in core/authProvider.ts met minimaal:

getAuthorizationUrl(state: string, nonce: string): string

handleCallback(params: { code: string; state: string; sessionState?: string; }): Promise<ProviderCallbackResult>

validateIdToken(idToken: string, nonce: string): Promise<ValidatedIdToken>

mapToUser(validatedToken: ValidatedIdToken): User

Of vergelijkbare logische splitsing. Belangrijk: scheid duidelijk “van OAuth-code naar user”.

Implementeer AzureAuthProvider in core/azureProvider.ts:

Bouw de authorization URL aan de hand van config.

Wissel de authorization code om voor tokens bij Azure.

Valideer ID token (handtekening, issuer, audience, nonce).

Extraheer relevante claims (sub, name, preferred_username / email, roles).

Maak een factory-functie createAuthProvider(config: AuthConfig):

Switcht op config.provider.

Geeft een instance van AzureAuthProvider terug (voor nu).

Definition of Done:

Unit-tests kunnen een mock-callback simuleren en resulteren in een valide User.

Azure-specifieke endpoints en parameters zijn correct opgebouwd.

Fouten (bijv. invalid state, invalid token) leveren consistente error-typen op.

Fase 3 – JWT-sessies & cookies

Doel: Een eenvoudige, veilige manier om sessies op te slaan in een cookie.

Taken:

Definieer een SessionPayload type:

Minimaal:

userId: string

name?: string

email?: string

roles?: string[]

Eventueel ruimte voor issuedAt, expiresAt.

Implementeer jwtSession.ts met functies:

createSessionCookie(user: User, config: AuthConfig): { name: string; value: string; attributes: CookieAttributes }

parseSessionCookie(cookieHeader: string | undefined, config: AuthConfig): SessionPayload | null

Cookie-kenmerken:

httpOnly: true

secure: true

sameSite: "lax"

path: "/"

Koppel het JWT-signing-secret aan een config/env (bijv. AJP_IDENTITY_JWT_SECRET).

Definition of Done:

Er bestaat een end-to-end flow: User → SessionPayload → JWT-cookie-string → SessionPayload terug.

Onjuiste of verlopen JWT’s worden afgewezen.

Fase 4 – Next.js handlers (login, callback, logout)

Doel: Developers moeten in Next.js alleen nog handlers “wires” hoeven exporteren.

Taken:

Implementeer in next/handlers een helper createAppRouterHandlers(config: AuthConfig) die minimaal oplevert:

loginHandler(request: NextRequest): NextResponse

callbackHandler(request: NextRequest): Promise<NextResponse>

logoutHandler(request: NextRequest): NextResponse

Login flow (loginHandler):

Genereer state en nonce (random, cryptografisch).

Zet state en nonce in kortlevende cookies.

Redirect naar Azure authorization URL via AuthProvider.getAuthorizationUrl.

Callback flow (callbackHandler):

Lees queryparams (code, state) uit de URL.

Vergelijk state met de cookie.

Gebruik AuthProvider.handleCallback om tokens te verkrijgen.

Valideer ID token + nonce.

Map naar User.

Maak sessie-JWT en zet die in een cookie.

Redirect naar config.postLoginRedirectPath.

Logout flow (logoutHandler):

Verwijder sessie-cookie (set cookie met lege waarde en direct-verlopen).

Eventueel redirect naar een Azure logout URL of eigen /login.

Bied een “wiring” voorbeeld (in docs) hoe de consumer dit gebruikt in app/api/auth/login/route.ts etc.

In de package zelf geen concrete app-mappen, alleen de helper-functie.

Definition of Done:

Met een simpele Next.js App Router setup kan een developer:

/api/auth/login aanmaken door export { loginHandler as GET } te doen.

/api/auth/callback idem.

/api/auth/logout idem.

Een complete login + callback + logout flow werkt in een demo-app.

Fase 5 – Server utilities (SSR, route-protectie)

Doel: Eenvoudige functies om ingelogde gebruikers op server-side te krijgen en routes te beschermen.

Taken:

Implementeer getServerUser in next/server/user.ts:

Neemt een NextRequest of een generieke Request plus AuthConfig.

Leest sessie-cookie.

Valideert JWT.

Geeft:

null als geen geldige sessie.

Anders een User object.

Implementeer requireAuth:

Variant voor App Router (server components) en voor route handlers.

Als geen sessie: redirect naar /login of een configurable path.

Als wel sessie: geeft User terug.

Optioneel: een simpele createAuthMiddleware(config):

Neemt een lijst van protected path patterns (bijv. /app/:path*).

Redirect naar /login als geen sessie.

Laat request door voor openbare routes.

Definition of Done:

In een demo-app kan een protected pagina worden gemaakt die:

Via requireAuth checkt of er een user is.

Anders redirect naar /login.

Fase 6 – React context & hooks

Doel: In React eenvoudig toegang tot de user en login/logout acties.

Taken:

Maak een context IdentityContext in react/IdentityContext.tsx:

Waarde bevat:

user: User | null

status: AuthStatus

login: () => void

logout: () => void

Implementeer <IdentityProvider>:

Props:

config: AuthConfig

children: ReactNode

Implementatie:

Client-side:

Fetch userstatus via een lichtgewicht endpoint of via cookies (designkeuze).

Bied login en logout functies die een redirect naar /api/auth/login / /api/auth/logout doen.

SSR:

Eventueel een versie die een initial user meegeeft via props (optioneel v2).

Implementeer useIdentity() hook:

Haalt context op.

Gooi een duidelijke error als de hook buiten de provider gebruikt wordt.

Definition of Done:

In een React-component binnen de Next-app kan een developer:

const { user, status, login, logout } = useIdentity();

login() leidt tot een redirect naar Azure login via de handler.

logout() verwijdert sessie en gaat terug naar login of home.

Fase 7 – LoginPage component

Doel: Kant-en-klare loginpagina, zonder afhankelijkheid van een UI-framework.

Taken:

Implementeer <LoginPage> in react/LoginPage.tsx:

Props:

title?: string (default: “Inloggen”)

subtitle?: string

brandName?: string (bijv. “Automatiseer Jouw Proces”)

logoUrl?: string

redirectPathAfterLogin?: string (optioneel, override op config)

Layout:

Simpele centered card met titel, subtitel, logo (optioneel) en één grote button “Inloggen met Azure”.

Button:

Roept login() uit useIdentity() aan.

Beschrijf in de docs hoe de consumer:

Een pagina app/login/page.tsx maakt die alleen <LoginPage /> rendert.

Voor error feedback (optioneel v1):

Ondersteun optioneel errorMessage?: string prop.

Documenteer dat ontwikkelaars een custom error-flow kunnen maken als ze willen.

Definition of Done:

Demo-app kan /login gebruiken met <LoginPage />.

Login-knop start de volledige Azure-flow.

Fase 8 – Public API design & exports

Doel: Een helder, klein publiek API-oppervlak.

Taken:

Bepaal de exports in src/index.ts:

createAuthConfig

createAppRouterHandlers

getServerUser

requireAuth

IdentityProvider

useIdentity

LoginPage

Types (optioneel):

User

AuthStatus

AuthConfig

Zorg dat de namen duidelijk zijn en passen bij @automatiseerjouwproces/identity-kit.

Controleer tree-shaking & bundling:

Geen Next.js-specifieke imports in de core-layer.

Next-specifieke code in next/*.

Definition of Done:

Een consumer kan alles wat nodig is importeren uit @automatiseerjouwproces/identity-kit.

Geen circular dependencies.

Fase 9 – Documentatie & voorbeeldproject

Doel: Interne teams moeten het pakket eenvoudig kunnen adopteren.

Taken:

Schrijf een beknopte README met:

Doel van de package.

Installatie:

npm install @automatiseerjouwproces/identity-kit

Configuratie via env-variabelen.

Voorbeeld voor:

auth.config.ts

app/api/auth/login/route.ts

app/api/auth/callback/route.ts

app/api/auth/logout/route.ts

app/layout.tsx met <IdentityProvider>

app/login/page.tsx met <LoginPage />

Maak een klein voorbeeldproject (mag in examples/ map):

Next.js App Router.

Eén protected route.

Werkende loginflow.

Definition of Done:

Een interne developer kan met de README in <1 uur een werkende login-flow aan de praat krijgen in een nieuwe Next-app.

6. Wanneer is de v1 van de package “af”?

De agent moet v1 als “af” beschouwen als:

Functioneel

Login via Azure werkt.

Callback verwerkt tokens veilig, maakt sessie-cookie.

Protected route werkt via requireAuth of middleware.

Logout verwijdert sessie en redirect.

Developer-ervaring

Consumer hoeft alleen:

AuthConfig aan te maken (via env).

3 API-routes te “wires”.

<IdentityProvider> rond de app te zetten.

/login pagina te maken met <LoginPage />.

Er is geen custom auth-code nodig in de app zelf.

Technisch

TypeScript build faalt niet.

ESM/CJS bundels worden correct gebouwd.

Geen hard-coded project-specifieke waardes in de core.

7. Korte samenvatting voor de agent

Opdracht:
Bouw @automatiseerjouwproces/identity-kit volgens bovenstaande fasering.
Start bij types en config, implementeer dan de Azure-authprovider, JWT-sessies, Next.js handlers, server utilities, React-context en de standaard loginpagina. Exporteer alles via een klein, helder public API en documenteer het gebruik met een voorbeeldproject.