from __future__ import annotations
from html import escape
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent
HTML_PATH = OUTPUT_DIR / "broadsheet.html"
PNG_PATH = OUTPUT_DIR / "entry.png"
PREVIEW_300_PATH = OUTPUT_DIR / "preview_300.png"

# N1 Land Paths (continent vector paths from 20 Nov entry)
LAND_PATHS = [
    "M26 16 L72 14 L98 20 L93 34 L84 46 L68 54 L61 63 L55 59 L46 47 L35 38 L24 29 Z",
    "M100 6 L120 6 L115 21 L102 19 Z",
    "M68 64 L89 67 L104 80 L97 100 L84 123 L76 124 L70 98 L64 76 Z",
    "M127 18 L163 15 L173 25 L167 36 L147 39 L131 38 L126 29 Z",
    "M127 23 L133 22 L132 30 L126 29 Z",
    "M129 42 L158 42 L170 55 L164 78 L154 102 L144 101 L136 78 L125 58 Z",
    "M165 16 L232 14 L258 24 L249 41 L230 50 L217 61 L204 62 L191 54 L172 46 L164 36 Z",
    "M247 35 L252 32 L253 41 L247 43 Z",
    "M219 66 L233 66 L236 72 L221 72 Z",
    "M226 83 L254 83 L257 103 L239 107 L225 99 Z",
    "M267 104 L274 102 L272 114 L265 113 Z",
]

# M3 Map Pins (cx, cy pre-resolved; Pin 12 is Lagos following verified swap)
MAP_PINS = [
    ("1", 165.5, 51.4, True),    # Cairo
    ("2", 80.7, 42.3, True),     # Washington, D.C.
    ("3", 91.0, 32.4, True),     # New York
    ("4", 45.1, 43.4, False),    # San Francisco
    ("5", 81.9, 71.6, False),    # Cartagena
    ("6", 78.3, 54.8, False),    # Palm Beach, FL
    ("7", 177.6, 56.9, False),   # Riyadh
    ("8", 67.4, 34.2, False),    # Chicago
    ("9", 201.5, 52.9, False),   # New Delhi
    ("10", 140.9, 29.3, False),  # London
    ("11", 64.0, 48.7, False),   # Terre Haute, IN (Booker / Nvidia)
    ("12", 143.7, 75.6, False),  # Lagos (Nigeria meth-lab swap)
    ("13", 153.8, 27.8, False),  # Geneva
]

# Regional Matrix (sums to 35, widths sum to 100.0%)
REGIONS = [
    ("Europe", 7, "#1D4ED8", 20.0),
    ("Asia-Pacific", 11, "#B91C1C", 31.4),
    ("Americas", 10, "#6D28D9", 28.6),
    ("Africa", 2, "#047857", 5.7),
    ("Middle East", 3, "#B45309", 8.6),
    ("Oceania", 2, "#0F766E", 5.7),
]

# 6 Key Performance Indicators (locked per spec)
KPIS = [
    ("31", "GIZA DEAD · RING ROAD EXPLOSION", "#B91C1C"),
    ("20%", "NEW CHINA TARIFF · USTR SECTION 301", "#B91C1C"),
    ("4.3%", "US Q3 GDP · REVISED ANNUALISED", "#047857"),
    ("3.8%", "US PCE INFLATION · CORE 3.3%", "#1D4ED8"),
    ("76", "HOSTAGES REVEALED · CARTAGENA", "#6D28D9"),
    ("3.2M", "AUSTRALIAN WOMEN · SURGE IN HARM", "#0F766E"),
]

LEADS = [
    {
        "num": "1",
        "kicker": "DISASTER · EGYPT",
        "hl": "FUEL TANKER INFERNO KILLS AT LEAST 31 ON GREATER CAIRO RING ROAD",
        "body": "A fuel tanker veered off, overturned and exploded above Tunnel 10 at Al-Warraq, Giza, on Wednesday evening (Thursday in Asia); fire engulfed 27 vehicles. Health Ministry: at least 31 killed, 21 hurt; 39 ambulances sent.",
        "source": "AP / CNN / Al Jazeera",
        "svg": """<svg viewBox="0 0 326 104" width="100%" height="100%">
          <defs>
            <linearGradient id="giza-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#090D16"/>
              <stop offset="100%" stop-color="#1E293B"/>
            </linearGradient>
            <radialGradient id="blast" cx="50%" cy="75%" r="65%">
              <stop offset="0%" stop-color="#FEF08A"/>
              <stop offset="25%" stop-color="#F97316"/>
              <stop offset="60%" stop-color="#DC2626"/>
              <stop offset="100%" stop-color="#7F1D1D" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="326" height="104" fill="url(#giza-sky)"/>
          <rect x="0" y="70" width="326" height="34" fill="#0F172A"/>
          <line x1="0" y1="84" x2="326" y2="84" stroke="#475569" stroke-width="2" stroke-dasharray="10 8"/>
          <!-- Tunnel 10 Portal -->
          <path d="M110 104 L110 74 C110 58 216 58 216 74 L216 104 Z" fill="#020617"/>
          <path d="M115 104 L115 75 C115 62 211 62 211 75 L211 104 Z" fill="#1E293B" opacity="0.6"/>
          <!-- Fireball & Explosion -->
          <circle cx="163" cy="62" r="42" fill="url(#blast)"/>
          <circle cx="140" cy="54" r="28" fill="#F97316" opacity="0.85"/>
          <circle cx="186" cy="54" r="28" fill="#DC2626" opacity="0.85"/>
          <circle cx="163" cy="46" r="20" fill="#FEF08A" opacity="0.95"/>
          <!-- Overturned Tanker Silhouette -->
          <rect x="135" y="72" width="56" height="15" rx="5" fill="#334155" stroke="#94A3B8" stroke-width="1.2"/>
          <circle cx="143" cy="88" r="5" fill="#020617"/>
          <circle cx="155" cy="88" r="5" fill="#020617"/>
          <circle cx="173" cy="88" r="5" fill="#020617"/>
          <circle cx="183" cy="88" r="5" fill="#020617"/>
          <!-- Overpass barrier -->
          <rect x="0" y="68" width="326" height="4" fill="#64748B"/>
          <!-- Alert Banner -->
          <rect x="8" y="8" width="168" height="16" rx="2" fill="#B91C1C"/>
          <text x="14" y="19.5" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="8px" font-weight="800" letter-spacing="0.05em">GIZA RING ROAD · TANKER EXPLOSION</text>
          <!-- Callout Badge -->
          <rect x="228" y="8" width="90" height="28" rx="3" fill="#1E293B" stroke="#B91C1C" stroke-width="1.2"/>
          <text x="273" y="21" fill="#FEF2F2" font-family="'Georgia', serif" font-size="11px" font-weight="900" text-anchor="middle">31 KILLED</text>
          <text x="273" y="31" fill="#FCA5A5" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">27 VEHICLES ABLAZE</text>
        </svg>"""
    },
    {
        "num": "2",
        "kicker": "TRADE · WASHINGTON",
        "hl": "TRUMP PROPOSES SECTION 301 TARIFFS ON 14 PARTNERS — 20% ON CHINA",
        "body": "President Trump proposed country-specific Section 301 tariffs Wednesday morning in Washington (Thursday in Asia) after an 8-month USTR probe: 20% on China atop ~25%, 15% caps for the EU, Japan, Korea, Taiwan and Switzerland; comments due Jan 5.",
        "source": "USTR / Reuters",
        "svg": """<svg viewBox="0 0 326 104" width="100%" height="100%">
          <defs>
            <linearGradient id="tariff-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1E1B4B"/>
              <stop offset="100%" stop-color="#312E81"/>
            </linearGradient>
          </defs>
          <rect width="326" height="104" fill="url(#tariff-bg)"/>
          <!-- Header Banner -->
          <rect x="8" y="8" width="160" height="16" rx="2" fill="#B91C1C"/>
          <text x="14" y="19.5" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="8px" font-weight="800" letter-spacing="0.05em">SECTION 301 · 14 PARTNERS</text>
          <!-- Partner Rate Bars -->
          <!-- China 20% -->
          <rect x="24" y="32" width="34" height="54" rx="2" fill="#DC2626"/>
          <text x="41" y="45" fill="#FFFFFF" font-family="'Georgia', serif" font-size="10px" font-weight="900" text-anchor="middle">20%</text>
          <text x="41" y="94" fill="#E2E8F0" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">CHINA</text>
          <!-- Korea 15% -->
          <rect x="70" y="48" width="34" height="38" rx="2" fill="#2563EB"/>
          <text x="87" y="60" fill="#FFFFFF" font-family="'Georgia', serif" font-size="9px" font-weight="900" text-anchor="middle">15%</text>
          <text x="87" y="94" fill="#E2E8F0" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">KOREA</text>
          <!-- India 17% -->
          <rect x="116" y="44" width="34" height="42" rx="2" fill="#D97706"/>
          <text x="133" y="56" fill="#FFFFFF" font-family="'Georgia', serif" font-size="9px" font-weight="900" text-anchor="middle">17%</text>
          <text x="133" y="94" fill="#E2E8F0" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">INDIA</text>
          <!-- EU 15% Cap -->
          <rect x="162" y="48" width="34" height="38" rx="2" fill="#2563EB"/>
          <text x="179" y="60" fill="#FFFFFF" font-family="'Georgia', serif" font-size="9px" font-weight="900" text-anchor="middle">15%</text>
          <text x="179" y="94" fill="#E2E8F0" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">EU</text>
          <!-- Japan 15% -->
          <rect x="208" y="48" width="34" height="38" rx="2" fill="#4F46E5"/>
          <text x="225" y="60" fill="#FFFFFF" font-family="'Georgia', serif" font-size="9px" font-weight="900" text-anchor="middle">15%</text>
          <text x="225" y="94" fill="#E2E8F0" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">JAPAN</text>
          <!-- Summary Callout -->
          <rect x="254" y="32" width="64" height="54" rx="3" fill="#1E1B4B" stroke="#6366F1" stroke-width="1.2"/>
          <text x="286" y="48" fill="#A5B4FC" font-family="'Inter', sans-serif" font-size="7px" font-weight="800" text-anchor="middle">PROBE</text>
          <text x="286" y="60" fill="#FFFFFF" font-family="'Georgia', serif" font-size="11px" font-weight="900" text-anchor="middle">8-MO</text>
          <text x="286" y="75" fill="#E0E7FF" font-family="'Inter', sans-serif" font-size="6.2px" text-anchor="middle">JAN 5 CMTS</text>
        </svg>"""
    },
    {
        "num": "3",
        "kicker": "ECONOMY · WASHINGTON",
        "hl": "US ECONOMY GREW 4.3% IN Q3; INFLATION 3.8% AS FED HIKE BETS NEAR 97%",
        "body": "The US economy grew an annualised 4.3% in Q3 (revised up from 3.4%), the BEA reported Wednesday (Thursday in Sydney); October PCE inflation was 3.8% year on year, core 3.3%. Markets now price a ~97% chance of a December Fed hike.",
        "source": "BEA / Reuters",
        "svg": """<svg viewBox="0 0 326 104" width="100%" height="100%">
          <defs>
            <linearGradient id="macro-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#064E3B"/>
              <stop offset="100%" stop-color="#022C22"/>
            </linearGradient>
          </defs>
          <rect width="326" height="104" fill="url(#macro-bg)"/>
          <!-- Banner -->
          <rect x="8" y="8" width="160" height="16" rx="2" fill="#047857"/>
          <text x="14" y="19.5" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="8px" font-weight="800" letter-spacing="0.05em">BEA SECOND ESTIMATE · Q3 GDP</text>
          <!-- GDP Revision visual -->
          <rect x="18" y="58" width="46" height="28" rx="2" fill="#059669" opacity="0.6"/>
          <text x="41" y="74" fill="#A7F3D0" font-family="'Georgia', serif" font-size="9px" font-weight="800" text-anchor="middle">3.4%</text>
          <text x="41" y="93" fill="#D1FAE5" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">ADVANCE</text>
          <!-- Arrow -->
          <path d="M72 68 L82 68 L78 64 M82 68 L78 72" stroke="#6EE7B7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- Revised GDP -->
          <rect x="92" y="38" width="58" height="48" rx="2" fill="#10B981"/>
          <text x="121" y="63" fill="#FFFFFF" font-family="'Georgia', serif" font-size="16px" font-weight="900" text-anchor="middle">4.3%</text>
          <text x="121" y="78" fill="#ECFDF5" font-family="'Inter', sans-serif" font-size="7.5px" font-weight="800" text-anchor="middle">Q3 REVISED</text>
          <!-- PCE Card -->
          <rect x="162" y="34" width="72" height="52" rx="3" fill="#065F46" stroke="#34D399" stroke-width="1.2"/>
          <text x="198" y="50" fill="#A7F3D0" font-family="'Inter', sans-serif" font-size="7px" font-weight="800" text-anchor="middle">OCT PCE PRICE</text>
          <text x="198" y="67" fill="#FFFFFF" font-family="'Georgia', serif" font-size="13px" font-weight="900" text-anchor="middle">3.8%</text>
          <text x="198" y="79" fill="#D1FAE5" font-family="'Inter', sans-serif" font-size="6.5px" text-anchor="middle">CORE PCE 3.3%</text>
          <!-- Fed Dec Hike Odds -->
          <rect x="244" y="34" width="74" height="52" rx="3" fill="#042F2E" stroke="#2DD4BF" stroke-width="1.2"/>
          <text x="281" y="49" fill="#99F6E4" font-family="'Inter', sans-serif" font-size="7px" font-weight="800" text-anchor="middle">DEC FED HIKE</text>
          <text x="281" y="67" fill="#F43F5E" font-family="'Georgia', serif" font-size="13px" font-weight="900" text-anchor="middle">~97%</text>
          <text x="281" y="79" fill="#CCFBF1" font-family="'Inter', sans-serif" font-size="6.5px" text-anchor="middle">SWAPS PRICED</text>
        </svg>"""
    }
]

FEATURES = [
    {
        "num": "4",
        "kicker": "MARKETS · NY & SF",
        "hl": "WALL STREET WILD COMEBACK AS NASDAQ CUTS LOSSES TO 0.6%",
        "body": "The Nasdaq closed down 0.62% Wednesday after plunging 4.6% intraday; the Dow rose 0.33% after a 1,100-point plunge and Nvidia fell 3.9% after a 9% slide. The 10-year yield held at 4.85%.",
        "source": "AP / WSJ",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#0F172A"/>
          <text x="8" y="14" fill="#94A3B8" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="800">NASDAQ INTRADAY REBOUND</text>
          <path d="M12 24 L52 56 L120 42 L180 32" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="52" cy="56" r="3.2" fill="#DC2626"/>
          <text x="52" y="65" fill="#F87171" font-family="'Inter', sans-serif" font-size="6.2px" font-weight="800" text-anchor="middle">-4.6% LOW</text>
          <circle cx="180" cy="32" r="3.2" fill="#10B981"/>
          <text x="180" y="24" fill="#34D399" font-family="'Inter', sans-serif" font-size="7px" font-weight="800" text-anchor="end">-0.62% CLOSE</text>
          <rect x="8" y="44" width="34" height="15" rx="2" fill="#1E293B"/>
          <text x="25" y="54" fill="#38BDF8" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="700" text-anchor="middle">DOW +0.3%</text>
        </svg>"""
    },
    {
        "num": "5",
        "kicker": "CRISIS · COLOMBIA",
        "hl": "POLICE REVEAL 76 HOSTAGES HELD IN CARTAGENA SUPERMARKET SIEGE",
        "body": "Colombian police revealed late Wednesday (Thursday in Sydney) that 76 people were held in the Cartagena supermarket siege — more than double the ~30 first reported. All were freed before dawn Wednesday; one assailant was killed.",
        "source": "AFP / Arab News",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#4C1D95"/>
          <text x="8" y="13" fill="#DDD6FE" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="800">CARTAGENA HOSTAGE REVELATION</text>
          <rect x="12" y="22" width="74" height="36" rx="2" fill="#2E1065" stroke="#8B5CF6" stroke-width="1"/>
          <text x="49" y="37" fill="#A78BFA" font-family="'Inter', sans-serif" font-size="6.5px" text-anchor="middle">FIRST REPORT</text>
          <text x="49" y="52" fill="#C4B5FD" font-family="'Georgia', serif" font-size="12px" font-weight="900" text-anchor="middle">~30</text>
          <path d="M92 40 L104 40" stroke="#DDD6FE" stroke-width="2"/>
          <rect x="108" y="18" width="76" height="42" rx="2" fill="#5B21B6" stroke="#C4B5FD" stroke-width="1.5"/>
          <text x="146" y="32" fill="#F5F3FF" font-family="'Inter', sans-serif" font-size="6.8px" font-weight="800" text-anchor="middle">FINAL COUNT</text>
          <text x="146" y="52" fill="#FDE047" font-family="'Georgia', serif" font-size="18px" font-weight="900" text-anchor="middle">76</text>
        </svg>"""
    },
    {
        "num": "6",
        "kicker": "DIPLOMACY · FLORIDA",
        "hl": "TRUMP HOSTS NATO CHIEF RUTTE FOR CLOSED-DOOR DINNER AT MAR-A-LAGO",
        "body": "Trump hosts NATO chief Mark Rutte for a closed-door dinner at Mar-a-Lago on Wednesday evening (Thursday in Sydney), with no joint readout planned; ahead of the dinner, Rutte told Fox News Trump is 'testing Putin'.",
        "source": "Palm Beach Post / Fox / NATO",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#1E3A8A"/>
          <text x="8" y="13" fill="#93C5FD" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="800">MAR-A-LAGO BILATERAL</text>
          <!-- NATO Compass -->
          <circle cx="42" cy="40" r="18" fill="none" stroke="#60A5FA" stroke-width="1.2"/>
          <path d="M42 24 L45 38 L58 40 L45 42 L42 56 L39 42 L26 40 L39 38 Z" fill="#93C5FD"/>
          <!-- Dinner Motif -->
          <rect x="80" y="24" width="102" height="34" rx="3" fill="#172554" stroke="#3B82F6" stroke-width="1"/>
          <text x="131" y="37" fill="#E0F2FE" font-family="'Georgia', serif" font-size="8.5px" font-weight="800" text-anchor="middle">TRUMP &amp; RUTTE</text>
          <text x="131" y="49" fill="#93C5FD" font-family="'Inter', sans-serif" font-size="6.5px" text-anchor="middle">'TESTING PUTIN'</text>
        </svg>"""
    },
    {
        "num": "7",
        "kicker": "CONFLICT · SAUDI ARABIA",
        "hl": "SAUDI DEFENCES INTERCEPT HOUTHI MISSILES OVER RIYADH",
        "body": "Saudi defences intercepted two Houthi ballistic missiles over Riyadh early Thursday, after a Houthi strike on Jazan port and a drone intercept near Jeddah Islamic Port on Wednesday. Secretary Rubio condemned the strikes.",
        "source": "Saudi-led coalition / Arab News",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#1C1917"/>
          <!-- Riyadh Skyline silhouettes -->
          <rect x="20" y="44" width="14" height="23" fill="#292524"/>
          <rect x="38" y="32" width="18" height="35" fill="#44403C"/>
          <polygon points="47,18 41,32 53,32" fill="#44403C"/>
          <rect x="60" y="40" width="16" height="27" fill="#292524"/>
          <!-- Radar Intercept Arc -->
          <path d="M10 60 Q96 0 160 30" fill="none" stroke="#EF4444" stroke-width="1.8" stroke-dasharray="4 3"/>
          <path d="M80 67 Q110 30 160 30" fill="none" stroke="#38BDF8" stroke-width="2"/>
          <circle cx="160" cy="30" r="5" fill="#FEF08A"/>
          <circle cx="160" cy="30" r="9" fill="none" stroke="#F97316" stroke-width="1.5"/>
          <rect x="98" y="46" width="86" height="16" rx="2" fill="#78350F"/>
          <text x="141" y="57" fill="#FEF3C7" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="800" text-anchor="middle">2 MISSILES DOWNED</text>
        </svg>"""
    },
    {
        "num": "8",
        "kicker": "WEATHER · USA",
        "hl": "THANKSGIVING STORM FORCES HISTORIC FIRST MACY'S PARADE POSTPONEMENT",
        "body": "A Thanksgiving Day nor'easter battered the East Coast on Thursday, snarling holiday travel and forcing the first-ever postponement of the 100th Macy's Thanksgiving Day Parade, to Saturday 28 November. US markets are closed Thursday.",
        "source": "AP / CBS / Axios",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#1E293B"/>
          <!-- Cloud & Gale -->
          <path d="M22 36 A12 12 0 0 1 44 28 A16 16 0 0 1 70 34 A10 10 0 0 1 68 46 L24 46 Z" fill="#64748B"/>
          <line x1="28" y1="52" x2="20" y2="60" stroke="#38BDF8" stroke-width="1.5"/>
          <line x1="42" y1="52" x2="34" y2="60" stroke="#38BDF8" stroke-width="1.5"/>
          <line x1="56" y1="52" x2="48" y2="60" stroke="#38BDF8" stroke-width="1.5"/>
          <!-- Balloon Silhouette -->
          <path d="M120 28 C120 18 140 18 140 28 C140 36 130 40 130 42 L130 46" fill="#F43F5E"/>
          <!-- Postponed Badge -->
          <rect x="94" y="44" width="90" height="18" rx="2" fill="#991B1B"/>
          <text x="139" y="53" fill="#FEE2E2" font-family="'Inter', sans-serif" font-size="6.5px" font-weight="800" text-anchor="middle">100th MACY'S PARADE</text>
          <text x="139" y="60" fill="#FEF08A" font-family="'Inter', sans-serif" font-size="6.0px" font-weight="800" text-anchor="middle">POSTPONED TO SAT 28</text>
        </svg>"""
    },
    {
        "num": "9",
        "kicker": "OBSERVANCE · INDIA",
        "hl": "INDIA MARKS CONSTITUTION DAY AS SAMVIDHAN DIVAS",
        "body": "India marks Constitution Day (Samvidhan Divas) on Thursday 26 November, commemorating the adoption of the Constitution in 1949 and honouring Dr B.R. Ambedkar's drafting legacy.",
        "source": "selfstudys / Indian Govt",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#431407"/>
          <!-- Tri-colour background accents -->
          <rect x="0" y="0" width="192" height="5" fill="#FF9933"/>
          <rect x="0" y="62" width="192" height="5" fill="#138808"/>
          <!-- Ashoka Chakra -->
          <circle cx="44" cy="34" r="16" fill="none" stroke="#000080" stroke-width="1.5"/>
          <circle cx="44" cy="34" r="3" fill="#000080"/>
          <!-- Emblem / Book -->
          <rect x="84" y="16" width="96" height="40" rx="3" fill="#7C2D12" stroke="#FDBA74" stroke-width="1.2"/>
          <text x="132" y="32" fill="#FFEDD5" font-family="'Georgia', serif" font-size="8.5px" font-weight="900" text-anchor="middle">SAMVIDHAN DIVAS</text>
          <text x="132" y="45" fill="#FED7AA" font-family="'Inter', sans-serif" font-size="6.8px" font-weight="700" text-anchor="middle">26 NOVEMBER 1949</text>
        </svg>"""
    },
    {
        "num": "10",
        "kicker": "BUSINESS · LONDON",
        "hl": "POUNDLAND FILES FOR ADMINISTRATION; 600 STORES AND 12,000 JOBS AT RISK",
        "body": "Poundland filed for administration on Wednesday, Sky News reported, with AlixPartners appointed; more than 600 stores and about 10,000–12,000 jobs are at risk across the UK and Ireland.",
        "source": "Sky News / Reuters",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#1E293B"/>
          <!-- Storefront -->
          <rect x="14" y="22" width="82" height="38" rx="2" fill="#047857" stroke="#10B981" stroke-width="1.2"/>
          <rect x="18" y="26" width="74" height="12" fill="#065F46"/>
          <text x="55" y="35" fill="#FFFFFF" font-family="'Georgia', serif" font-size="8.5px" font-weight="900" text-anchor="middle">POUNDLAND</text>
          <!-- Callout -->
          <rect x="104" y="18" width="78" height="42" rx="3" fill="#881337" stroke="#F43F5E" stroke-width="1.2"/>
          <text x="143" y="32" fill="#FFE4E6" font-family="'Georgia', serif" font-size="11px" font-weight="900" text-anchor="middle">600 STORES</text>
          <text x="143" y="44" fill="#FECDD3" font-family="'Inter', sans-serif" font-size="7px" font-weight="700" text-anchor="middle">12,000 JOBS</text>
          <text x="143" y="54" fill="#FDA4AF" font-family="'Inter', sans-serif" font-size="5.8px" text-anchor="middle">ALIXPARTNERS</text>
        </svg>"""
    },
    {
        "num": "11",
        "kicker": "TECH · WASHINGTON",
        "hl": "SENATOR BOOKER DEMANDS ANSWERS FROM NVIDIA OVER HUANG'S RETURN",
        "body": "Senator Cory Booker, the top Democrat on the Senate antitrust subcommittee, demanded answers from Nvidia on Wednesday about CEO Jensen Huang's return, pressing the Trump administration's role and the board's probe of Huang's China links.",
        "source": "Reuters",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#14532D"/>
          <!-- Microchip icon -->
          <rect x="16" y="20" width="34" height="34" rx="3" fill="#166534" stroke="#4ADE80" stroke-width="1.5"/>
          <text x="33" y="40" fill="#BBF7D0" font-family="'Inter', sans-serif" font-size="7.5px" font-weight="900" text-anchor="middle">NVIDIA</text>
          <!-- Chip pins -->
          <line x1="10" y1="28" x2="16" y2="28" stroke="#4ADE80" stroke-width="1.5"/>
          <line x1="10" y1="38" x2="16" y2="38" stroke="#4ADE80" stroke-width="1.5"/>
          <line x1="10" y1="48" x2="16" y2="48" stroke="#4ADE80" stroke-width="1.5"/>
          <!-- Congressional Letter Card -->
          <rect x="62" y="18" width="120" height="42" rx="3" fill="#052E16" stroke="#22C55E" stroke-width="1"/>
          <text x="122" y="32" fill="#DCFCE7" font-family="'Georgia', serif" font-size="8px" font-weight="900" text-anchor="middle">SENATE ANTITRUST</text>
          <text x="122" y="44" fill="#86EFAC" font-family="'Inter', sans-serif" font-size="6.8px" font-weight="700" text-anchor="middle">BOOKER TO NVIDIA BOARD</text>
          <text x="122" y="54" fill="#4ADE80" font-family="'Inter', sans-serif" font-size="5.8px" text-anchor="middle">SUBPOENA &amp; TRUMP PROBE</text>
        </svg>"""
    },
    {
        "num": "12",
        "kicker": "CRIME · NIGERIA",
        "hl": "FIVE MEXICANS ARRESTED IN NIGERIA OVER $227M INDUSTRIAL METH LAB",
        "body": "Five Mexican nationals were arrested in Nigeria after the NDLEA dismantled a massive industrial methamphetamine lab in Enugu State, seizing 1.5 tonnes of meth and chemicals valued at $227 million.",
        "source": "BBC Africa / NDLEA",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#064E3B"/>
          <!-- Barrel silhouettes -->
          <rect x="18" y="26" width="16" height="26" rx="2" fill="#047857" stroke="#34D399" stroke-width="1"/>
          <rect x="38" y="22" width="18" height="30" rx="2" fill="#065F46" stroke="#6EE7B7" stroke-width="1.2"/>
          <text x="47" y="40" fill="#A7F3D0" font-family="'Inter', sans-serif" font-size="6px" font-weight="800" text-anchor="middle">1.5T</text>
          <!-- Callout -->
          <rect x="68" y="16" width="112" height="44" rx="3" fill="#022C22" stroke="#10B981" stroke-width="1.2"/>
          <text x="124" y="30" fill="#ECFDF5" font-family="'Georgia', serif" font-size="11px" font-weight="900" text-anchor="middle">$227M METH BUST</text>
          <text x="124" y="43" fill="#A7F3D0" font-family="'Inter', sans-serif" font-size="7px" font-weight="700" text-anchor="middle">5 MEXICANS ARRESTED</text>
          <text x="124" y="53" fill="#6EE7B7" font-family="'Inter', sans-serif" font-size="6.0px" text-anchor="middle">ENUGU STATE INDUSTRIAL LAB</text>
        </svg>"""
    },
    {
        "num": "13",
        "kicker": "SPORT · GENEVA",
        "hl": "GUKESH AND SINDAROV TIED 1–1 AS WORLD CHESS GAME 3 BEGINS IN GENEVA",
        "body": "Gukesh Dommaraju and Javokhir Sindarov are tied 1.0–1.0 after Game 2 of the FIDE World Chess Championship in Geneva; Game 3 begins Thursday 26 November at 15:00 CET.",
        "source": "FIDE / Chess.com / Guardian",
        "svg": """<svg viewBox="0 0 192 67" width="100%" height="100%">
          <rect width="192" height="67" fill="#18181B"/>
          <!-- Chessboard mini-grid -->
          <g transform="translate(14, 16)">
            <rect width="36" height="36" fill="#3F3F46" stroke="#71717A" stroke-width="1"/>
            <rect x="0" y="0" width="18" height="18" fill="#D4D4D8"/>
            <rect x="18" y="18" width="18" height="18" fill="#D4D4D8"/>
            <text x="9" y="13" font-size="12" text-anchor="middle">♚</text>
            <text x="27" y="31" font-size="12" text-anchor="middle">♔</text>
          </g>
          <!-- Scorecard -->
          <rect x="62" y="16" width="118" height="40" rx="3" fill="#27272A" stroke="#A1A1AA" stroke-width="1"/>
          <text x="121" y="29" fill="#F4F4F5" font-family="'Georgia', serif" font-size="8.5px" font-weight="900" text-anchor="middle">FIDE WORLD CHAMPIONSHIP</text>
          <text x="121" y="42" fill="#E4E4E7" font-family="'Inter', sans-serif" font-size="9px" font-weight="800" text-anchor="middle">TIED 1.0 – 1.0</text>
          <text x="121" y="52" fill="#A1A1AA" font-family="'Inter', sans-serif" font-size="6px" text-anchor="middle">GAME 3 THU 15:00 CET</text>
        </svg>"""
    }
]

BRIEFS_COL1 = [
    ("14", "Europe / Poland", "Poland raises security concerns and eastern no-fly-zone plans after renewed airspace violations.", "Libre News"),
    ("15", "Asia-Pac / China", "Xi ousts Shanghai Party chief Chen Jining in a shock move, widening China's biggest leadership shakeup in decades.", "Japan Times / SCMP"),
    ("16", "Americas / USA", "Six Florida family members are identified after a deadly plane crash off the Mississippi Gulf coast.", "Qatar Tribune / TOI"),
    ("17", "Europe / Spain", "Nearly 2,000 migrants reach Spain's Canary Islands in a record single-day arrival.", "Manila Times / AP"),
    ("18", "Asia-Pac / Malaysia", "Malaysian regulator MCMC sues Google for RM600M ($146M) across two YouTube content suits.", "Manila Times / CNA"),
    ("19", "Asia-Pac / North Korea", "North Korea expels Swiss Diplomatic Office head Sylvain Astier within 48 hours over children's camp sanctions.", "Manila Times / NK News"),
    ("20", "Asia-Pac / China", "China urges Japan to accelerate destruction of abandoned chemical weapons left in China, at the Chemical Weapons Convention session in The Hague.", "Xinhua"),
    ("21", "Oceania / Australia", "Virgin Australia check-in and gate workers strike Thursday 26 November across Adelaide, Brisbane, Melbourne and Sydney over pay.", "Sea7 / AeroCorner"),
    ("22", "Americas / USA", "Musk's SpaceX receives an FCC filing step for its orbital data-centre satellite constellation ('Starmind', DA 26-1273).", "ET / FCC"),
    ("23", "Americas / USA", "Nvidia CEO Jensen Huang admits 'terrible mistakes' and apologises to staff over code-of-conduct violations.", "ET / Guardian"),
    ("24", "Middle East / Lebanon", "A Lebanese judge issues arrest warrants for five detained Hezbollah members and orders three more brought in for questioning.", "Arab News / AFP"),
]

BRIEFS_COL2 = [
    ("25", "Middle East / Iran", "Iran FM Araghchi rejects Israel's chemical-weapons allegation; Tehran denounces US military AI strikes.", "Symplexia / Geo"),
    ("26", "Asia-Pac / South Korea", "South Korea prepares an EV industry support package, with a proposed ₩2.5M (~$1,870) tax credit per locally made EV, as Chinese models reach 43.5% of registrations.", "Reuters"),
    ("27", "Asia-Pac / India", "The IPL 2027 player auction receives 1,220 player registrations.", "BCCI / selfstudys"),
    ("28", "Asia-Pac / India", "Flipkart Group CEO Kalyan Krishnamurthy steps down effective Dec 4; Balaji Thiagarajan named interim.", "TechCrunch / selfstudys"),
    ("29", "Asia-Pac / China", "Alice Huang-linked firms listed $270M in AI servers in China, records show.", "Reuters / ET"),
    ("30", "Europe / UK", "The UK's Royal Air Force moves warplanes into hangars and hardened shelters overnight amid heightened drone and sabotage fears.", "The Times / Sky News"),
    ("31", "Asia-Pac / India", "India confirms Wednesday evening (18:24 UTC Wed) military talks with China in Arunachal Pradesh along the Line of Actual Control (LAC).", "Indian Express / ET"),
    ("32", "Europe / EU", "The European Commission says the US must respect the 15% tariff ceiling for the EU after Greer's Section 301 launch.", "Reuters / ET"),
    ("33", "Americas / USA", "US initial jobless claims fall to 189,000, signalling a resilient labour market.", "US Labor Dept / ET"),
    ("34", "Asia-Pac / Pakistan", "Pakistan International Airlines shifts UK flights to its own Boeing 777 fleet starting Thursday 26 Nov after the Norse Atlantic suspension.", "Reuters"),
    ("35", "Oceania / Australia", "AIHW survey shows 3.2 million Australian women experienced alcohol-related abuse or fear in 2025 (+800,000 vs 2022–23).", "AIHW / FARE / NewsHub"),
]

DATE_CHECK_TEXT = (
    "<strong>DATE DISCIPLINE (THU 26 NOV ONLY — EXCLUDED PRIOR-DAY EVENTS):</strong> "
    "Events count if they occurred or broke 26 Nov 2026 in any timezone (≥13:00 UTC Wed = Thu Sydney; ≥15:00 Tokyo; ≥17:00 SE Asia; tagged inline). "
    "Valid outcomes: #2 tariffs & #3 GDP/PCE (13:30 UTC Wed), #5 76-hostage tally (21:02 UTC Wed), #6 Trump–Rutte (00:00 UTC Thu). "
    "Excluded: Shenzhou-24 (Wed 00:18–06:35 UTC), Huawei 10/12 (Tue NY), Aus–Solomons pact. "
    "Purged traps: US consumer confidence (Tue), Senegal AFCON CAS (Tue), Nepal ₹15,000cr (22–23 Nov), Hasina return, NATO AWACS, "
    "Cuba WHO remarks (24–25 Nov), Trump executions memo (Mon), Golden Dragon drills (Wed AM), Bangladesh wage vote (Tue 20:00 UTC)."
)


def render_world_map_svg() -> str:
    polys = "\n    ".join(
        f'<path d="{p}" fill="#DFD7C2" stroke="#9D9278" stroke-width="0.6" stroke-linejoin="round"/>'
        for p in LAND_PATHS
    )

    # Render Feature pins first (r=5.3px), then Lead pins on top (r=6.4px)
    feat_pins = []
    lead_pins = []
    for num, cx, cy, is_lead in MAP_PINS:
        if is_lead:
            lead_pins.append(
                f'<g transform="translate({cx},{cy})">'
                f'<circle cx="0" cy="0" r="6.4" fill="#B91C1C" stroke="#FFFFFF" stroke-width="1.0"/>'
                f'<text x="0" y="2.6" fill="#FFFFFF" font-family="\'Inter\', sans-serif" font-size="7.2px" font-weight="900" text-anchor="middle">{num}</text>'
                f'</g>'
            )
        else:
            feat_pins.append(
                f'<g transform="translate({cx},{cy})">'
                f'<circle cx="0" cy="0" r="5.3" fill="#1D4ED8" stroke="#FFFFFF" stroke-width="0.9"/>'
                f'<text x="0" y="2.2" fill="#FFFFFF" font-family="\'Inter\', sans-serif" font-size="6.1px" font-weight="900" text-anchor="middle">{num}</text>'
                f'</g>'
            )

    pins_str = "\n    ".join(feat_pins + lead_pins)

    return f"""<svg viewBox="0 0 282 144" width="282" height="144">
      <rect width="282" height="144" fill="#E8E2D2" rx="3"/>
      {polys}
      {pins_str}
    </svg>"""


def generate_html() -> str:
    map_svg = render_world_map_svg()

    # KPI strip HTML
    kpi_cells = []
    for val, label, col in KPIS:
        kpi_cells.append(
            f'<div class="kpi-cell">'
            f'  <div class="kpi-val" style="color: {col};">{escape(val)}</div>'
            f'  <div class="kpi-lbl">{escape(label)}</div>'
            f'</div>'
        )
    kpi_strip_html = "\n".join(kpi_cells)

    # Region bar HTML
    reg_segs = []
    for name, cnt, col, w in REGIONS:
        reg_segs.append(
            f'<div class="reg-seg" style="width: {w}%; background: {col};">'
            f'  {escape(name)} {cnt}'
            f'</div>'
        )
    reg_bar_html = "\n".join(reg_segs)

    # Leads HTML
    lead_cards = []
    for c in LEADS:
        lead_cards.append(
            f'<div class="lead-card">'
            f'  <div class="lead-art">{c["svg"]}</div>'
            f'  <div class="lead-meta">'
            f'    <span class="npill np-lead">{c["num"]}</span><span class="kicker-txt">{escape(c["kicker"])}</span>'
            f'  </div>'
            f'  <h2 class="lead-hl">{escape(c["hl"])}</h2>'
            f'  <p class="lead-body">{escape(c["body"])} <span class="src-cite">({escape(c["source"])})</span></p>'
            f'</div>'
        )
    leads_html = "\n".join(lead_cards)

    # Features HTML
    feat_cards = []
    for f in FEATURES:
        feat_cards.append(
            f'<div class="feat-card">'
            f'  <div class="feat-art">{f["svg"]}</div>'
            f'  <div class="feat-meta">'
            f'    <span class="npill np-feat">{f["num"]}</span><span class="kicker-txt">{escape(f["kicker"])}</span>'
            f'  </div>'
            f'  <h3 class="feat-hl">{escape(f["hl"])}</h3>'
            f'  <p class="feat-body">{escape(f["body"])} <span class="src-cite">({escape(f["source"])})</span></p>'
            f'</div>'
        )
    feats_html = "\n".join(feat_cards)

    # Briefs HTML
    def render_brief_col(items):
        res = []
        for num, reg, text, src in items:
            res.append(
                f'<div class="brief-item">'
                f'  <span class="npill np-brief">{num}</span>'
                f'  <span class="brief-txt"><strong>[{escape(reg)}]</strong> {escape(text)} <span class="src-cite">({escape(src)})</span></span>'
                f'</div>'
            )
        return "\n".join(res)

    briefs_col1_html = render_brief_col(BRIEFS_COL1)
    briefs_col2_html = render_brief_col(BRIEFS_COL2)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>The World in One Day — 26 November 2026</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1024px;
    height: 1024px;
    background: #F5F1E8;
    color: #0F172A;
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }}
  .newspaper-container {{
    width: 1024px;
    height: 1024px;
    padding: 8px 17px 7px 17px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  /* Top Bar */
  .top-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0F172A;
    padding-bottom: 2px;
    font-size: 7.8px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }}
  .top-bar-left {{ color: #0F172A; }}
  .top-bar-right {{ color: #B91C1C; }}

  /* Masthead & Deck */
  .masthead-block {{
    text-align: center;
    border-bottom: 1.5px solid #0F172A;
    padding: 1px 0 2px 0;
  }}
  .masthead-title {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 50px;
    line-height: 0.94;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #0F172A;
    text-transform: uppercase;
  }}
  .deck-row {{
    display: flex;
    justify-content: center;
    gap: 12px;
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 9.4px;
    font-weight: 700;
    color: #334155;
    margin-top: 2px;
  }}

  /* KPI Strip */
  .kpi-strip {{
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 3px;
    padding: 2.5px 0;
  }}
  .kpi-cell {{
    text-align: center;
    border-right: 1px solid #E2E8F0;
    padding: 0 4px;
  }}
  .kpi-cell:last-child {{ border-right: none; }}
  .kpi-val {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 18.5px;
    line-height: 1.05;
    font-weight: 900;
  }}
  .kpi-lbl {{
    font-size: 6.0px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #475569;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
  }}

  /* Region Bar */
  .region-bar {{
    display: flex;
    height: 13px;
    border-radius: 2px;
    overflow: hidden;
  }}
  .reg-seg {{
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-size: 7.6px;
    font-weight: 800;
    letter-spacing: 0.015em;
    white-space: nowrap;
    overflow: hidden;
  }}

  /* Shared Pills & Meta */
  .npill {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    font-weight: 900;
    color: #FFFFFF;
  }}
  .np-lead {{ width: 14px; height: 13px; font-size: 8px; background: #B91C1C; margin-right: 5px; }}
  .np-feat {{ width: 12px; height: 11px; font-size: 7px; background: #1D4ED8; margin-right: 4px; }}
  .np-brief {{ width: 13px; height: 11px; font-size: 6.8px; background: #475569; margin-right: 4px; flex-shrink: 0; }}
  .kicker-txt {{ font-size: 7.8px; font-weight: 800; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.04em; }}
  .src-cite {{ color: #64748B; font-weight: 600; font-size: 0.92em; }}

  /* Lead Grid */
  .lead-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 9px;
  }}
  .lead-card {{
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 3px;
    padding: 5px 6px 5px 6px;
    display: flex;
    flex-direction: column;
  }}
  .lead-art {{
    width: 312px;
    height: 86px;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 3px;
  }}
  .lead-meta {{
    display: flex;
    align-items: center;
    margin-bottom: 2px;
  }}
  .lead-hl {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 14.6px;
    line-height: 1.12;
    font-weight: 900;
    max-height: 52px;
    overflow: hidden;
    color: #0F172A;
    margin-bottom: 3px;
  }}
  .lead-body {{
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 8.7px;
    line-height: 1.17;
    max-height: 48px;
    overflow: hidden;
    color: #1E293B;
  }}

  /* Feature Grid (5 cols x 2 rows) */
  .feat-grid {{
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }}
  .feat-card {{
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 3px;
    padding: 3px 4.5px;
    display: flex;
    flex-direction: column;
  }}
  .feat-art {{
    width: 182px;
    height: 48px;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 2px;
  }}
  .feat-meta {{
    display: flex;
    align-items: center;
    margin-bottom: 2px;
  }}
  .feat-hl {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 9.6px;
    line-height: 1.05;
    font-weight: 900;
    max-height: 31px;
    overflow: hidden;
    color: #0F172A;
    margin-bottom: 2px;
  }}
  .feat-body {{
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 7.0px;
    line-height: 1.12;
    max-height: 32px;
    overflow: hidden;
    color: #334155;
  }}

  /* Bottom Section: Map (left) + Briefs (2 cols) */
  .bottom-section {{
    display: flex;
    gap: 8px;
    height: 202px;
  }}
  .map-box {{
    width: 282px;
    height: 202px;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 3px;
    padding: 4px 5px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}
  .map-title {{
    font-size: 7.2px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: 0.04em;
    display: flex;
    justify-content: space-between;
  }}
  .map-art {{
    width: 272px;
    height: 144px;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .briefs-box {{
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 3px;
    padding: 4px 6px;
    height: 202px;
    overflow: hidden;
  }}
  .brief-col {{
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    overflow: hidden;
  }}
  .brief-item {{
    display: flex;
    align-items: flex-start;
    font-size: 6.9px;
    line-height: 1.11;
    color: #1E293B;
  }}
  .brief-txt {{
    overflow: hidden;
  }}

  /* Footer & Date Check */
  .footer-block {{
    display: flex;
    flex-direction: column;
    gap: 2px;
  }}
  .date-check {{
    border: 1.4px solid #B91C1C;
    background: #FEF2F2;
    color: #7F1D1D;
    font-size: 7.2px;
    line-height: 1.16;
    padding: 2.5px 6px;
    border-radius: 2px;
  }}
  .colophon {{
    display: flex;
    justify-content: space-between;
    font-size: 6.8px;
    font-weight: 700;
    color: #64748B;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }}
</style>
</head>
<body>
<div class="newspaper-container">

  <!-- 1. Top Bar -->
  <div class="top-bar">
    <div class="top-bar-left">THE WORLD IN ONE DAY &nbsp;|&nbsp; 35 SOURCED STORIES &nbsp;·&nbsp; 6 CONTINENTS</div>
    <div class="top-bar-right">ISSUE #26 &nbsp;·&nbsp; VERIFIED 26 NOV 2026 EDITION</div>
  </div>

  <!-- 2. Masthead -->
  <div class="masthead-block">
    <h1 class="masthead-title">Thursday 26 November 2026</h1>
    <div class="deck-row">
      <span>Giza Tanker Inferno Kills 31</span>
      <span>•</span>
      <span>Trump Proposes 20% Section 301 China Tariff</span>
      <span>•</span>
      <span>US Q3 GDP Up 4.3%, PCE Inflation 3.8%</span>
    </div>
  </div>

  <!-- 3. KPI Strip -->
  <div class="kpi-strip">
    {kpi_strip_html}
  </div>

  <!-- 4. Region Bar -->
  <div class="region-bar">
    {reg_bar_html}
  </div>

  <!-- 5. Leads (Stories 1–3) -->
  <div class="lead-grid">
    {leads_html}
  </div>

  <!-- 6. Features (Stories 4–13) -->
  <div class="feat-grid">
    {feats_html}
  </div>

  <!-- 7. Map + World Briefs (Stories 14–35) -->
  <div class="bottom-section">
    <div class="map-box">
      <div class="map-title">
        <span>GLOBAL REPORTING PINS (1–13)</span>
        <span style="color: #64748B;">MILLER PROJECTION</span>
      </div>
      <div class="map-art">{map_svg}</div>
      <div class="map-title" style="color: #64748B; font-size: 6.5px;">
        <span>● LEADS (1–3) RED &nbsp; ● FEATURES (4–13) BLUE</span>
        <span>LAGOS #12 SWAP APPLIED</span>
      </div>
    </div>
    <div class="briefs-box">
      <div class="brief-col">
        {briefs_col1_html}
      </div>
      <div class="brief-col">
        {briefs_col2_html}
      </div>
    </div>
  </div>

  <!-- 8. Date Check & Colophon -->
  <div class="footer-block">
    <div class="date-check">
      {DATE_CHECK_TEXT}
    </div>
    <div class="colophon">
      <div>DISPATCHES VIA REUTERS · AP · AFP · BLOOMBERG · WSJ · SKY NEWS · CNA · XINHUA · FIDE</div>
      <div>DETERMINISTIC EMBEDDED RENDER · ZERO EXTERNAL ASSETS · ZERO NETWORK</div>
    </div>
  </div>

</div>
</body>
</html>"""


def main():
    html_content = generate_html()
    HTML_PATH.write_text(html_content, encoding="utf-8")
    print(f"Wrote HTML template to {HTML_PATH} ({len(html_content)} bytes)")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
        page.goto(HTML_PATH.as_uri(), wait_until="networkidle")
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(300)
        page.screenshot(path=str(PNG_PATH), full_page=False)
        browser.close()

    img = Image.open(PNG_PATH).convert("RGB")
    assert img.size == (1024, 1024), f"Expected 1024x1024, got {img.size}"
    img.save(PNG_PATH, format="PNG", optimize=True)
    png_size = PNG_PATH.stat().st_size
    assert png_size < 1_048_576, f"PNG exceeds 1 MiB cap: {png_size} bytes"
    print(f"Saved optimized entry.png: {img.size}, {png_size} bytes")

    img.resize((300, 300), Image.Resampling.LANCZOS).save(PREVIEW_300_PATH, format="PNG", optimize=True)
    print(f"Saved preview_300.png ({PREVIEW_300_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
