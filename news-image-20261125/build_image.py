from __future__ import annotations
from html import escape
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent
HTML_PATH = OUTPUT_DIR / "broadsheet.html"
PNG_PATH = OUTPUT_DIR / "entry.png"
PREVIEW_300_PATH = OUTPUT_DIR / "preview_300.png"

# Quantitative Shock Strip: 6 verified Wednesday 25 Nov figures
KPIS: list[tuple[str, str, str]] = [
    ("4.9%", "AUSTRALIA OCT CPI · ELECTRICITY +25.2%", "#B91C1C"),
    ("10 of 12", "HUAWEI GUILTY COUNTS · NY JURY VERDICT", "#1D4ED8"),
    ("25", "CARTAGENA HOSTAGES · SUPERMARKET SIEGE", "#B45309"),
    ("700,000+", "RUSSIAN WAR DEAD · RFE/RL WED ANALYSIS", "#6D28D9"),
    ("$3,545", "SPOT GOLD / OZ · WED 00:24 GMT (-0.3%)", "#0F766E"),
    ("65,000", "NIKKEI 225 TARGET · REUTERS POLL, JUN 2027", "#047857"),
]

# Region Distribution Matrix: exactly 35 stories across 6 continents
REGIONS: list[tuple[str, int, str, float]] = [
    ("Europe", 6, "#1D4ED8", 17.1),
    ("Asia-Pacific", 11, "#B91C1C", 31.4),
    ("Americas", 9, "#6D28D9", 25.7),
    ("Africa", 3, "#047857", 8.6),
    ("Middle East", 4, "#B45309", 11.4),
    ("Oceania", 2, "#0F766E", 5.8),
]


def svg_lead1_huawei() -> str:
    # 10 guilty (crimson #B91C1C) and 2 acquitted (slate #475569)
    cells = []
    for i in range(12):
        row = i // 6
        col = i % 6
        x = 160 + col * 26
        y = 35 + row * 24
        is_guilty = i < 10
        bg_col = "#B91C1C" if is_guilty else "#475569"
        txt = "G" if is_guilty else "ACQ"
        cells.append(
            f'<rect x="{x}" y="{y}" width="23" height="20" rx="2" fill="{bg_col}"/>'
            f'<text x="{x + 11.5}" y="{y + 14}" text-anchor="middle" fill="#FFFFFF" font-family="\'Inter\', sans-serif" font-size="8.5" font-weight="800">{txt}</text>'
        )

    return f"""<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="326" height="104" fill="#0F172A"/>
  <line x1="10" y1="30" x2="316" y2="30" stroke="#1E293B" stroke-width="0.8"/>
  <line x1="10" y1="84" x2="316" y2="84" stroke="#1E293B" stroke-width="0.8"/>
  <rect x="0" y="0" width="220" height="20" fill="#B91C1C"/>
  <text x="110" y="14" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" letter-spacing="0.04em">BROOKLYN FEDERAL VERDICT · HUAWEI</text>
  
  <!-- Scales of justice & gavel symbol -->
  <g stroke="#F59E0B" stroke-width="1.8" fill="none">
    <line x1="75" y1="34" x2="75" y2="76"/>
    <line x1="50" y1="42" x2="100" y2="42"/>
    <line x1="50" y1="42" x2="42" y2="58"/>
    <line x1="50" y1="42" x2="58" y2="58"/>
    <line x1="100" y1="42" x2="92" y2="58"/>
    <line x1="100" y1="42" x2="108" y2="58"/>
    <path d="M38 58 Q50 64 62 58 Z" fill="#F59E0B" opacity="0.6"/>
    <path d="M88 58 Q100 64 112 58 Z" fill="#F59E0B" opacity="0.6"/>
    <line x1="60" y1="76" x2="90" y2="76" stroke-width="2.5"/>
  </g>
  <!-- Gavel -->
  <g transform="translate(18, 48) rotate(-25)">
    <rect x="0" y="0" width="18" height="9" rx="1.5" fill="#F59E0B"/>
    <line x1="9" y1="9" x2="9" y2="28" stroke="#F59E0B" stroke-width="2"/>
  </g>

  <!-- 12-cell matrix -->
  {"".join(cells)}

  <!-- Bottom callout -->
  <rect x="156" y="86" width="164" height="15" rx="2" fill="#B91C1C" opacity="0.95"/>
  <text x="238" y="97" text-anchor="middle" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="7.8" font-weight="800">10 OF 12 GUILTY · TUE NY / WED ASIA</text>
</svg>"""


def svg_lead2_colombia() -> str:
    return """<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="326" height="104" fill="#18181B"/>
  
  <!-- Searchlight beams -->
  <polygon points="15,104 90,20 120,20 40,104" fill="#FEF08A" opacity="0.12"/>
  <polygon points="310,104 220,20 190,20 270,104" fill="#FEF08A" opacity="0.12"/>

  <!-- Top banner -->
  <rect x="0" y="0" width="225" height="20" fill="#B91C1C"/>
  <text x="112" y="14" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" letter-spacing="0.04em">CARTAGENA SIEGE · COLOMBIA STANDOFF</text>

  <!-- Éxito supermarket facade -->
  <rect x="35" y="28" width="120" height="46" fill="#27272A" stroke="#3F3F46" stroke-width="1"/>
  <rect x="45" y="32" width="100" height="15" fill="#DC2626" rx="2"/>
  <text x="95" y="43" text-anchor="middle" fill="#FEF08A" font-family="'Inter', sans-serif" font-size="10" font-weight="900" letter-spacing="0.1em">ÉXITO</text>
  <!-- Doors/windows -->
  <rect x="50" y="52" width="24" height="22" fill="#3B82F6" opacity="0.3"/>
  <rect x="83" y="52" width="24" height="22" fill="#3B82F6" opacity="0.3"/>
  <rect x="116" y="52" width="24" height="22" fill="#3B82F6" opacity="0.3"/>

  <!-- Armoured cash truck silhouette -->
  <g transform="translate(180, 42)">
    <rect x="0" y="6" width="60" height="24" rx="3" fill="#3F3F46" stroke="#71717A" stroke-width="1"/>
    <rect x="42" y="10" width="18" height="14" rx="2" fill="#52525B"/>
    <rect x="47" y="12" width="10" height="6" fill="#93C5FD" opacity="0.6"/>
    <!-- Wheels -->
    <circle cx="15" cy="30" r="6" fill="#18181B" stroke="#A1A1AA" stroke-width="1.5"/>
    <circle cx="48" cy="30" r="6" fill="#18181B" stroke="#A1A1AA" stroke-width="1.5"/>
    <text x="22" y="21" fill="#E4E4E7" font-family="'Consolas', monospace" font-size="6.5" font-weight="700">VALORES</text>
  </g>

  <!-- Police cordon tape -->
  <g transform="translate(0, 80) rotate(-1)">
    <rect x="0" y="0" width="330" height="10" fill="#EAB308"/>
    <line x1="0" y1="0" x2="330" y2="0" stroke="#000" stroke-width="0.5"/>
    <line x1="0" y1="10" x2="330" y2="10" stroke="#000" stroke-width="0.5"/>
    <!-- Diagonal hazard stripes -->
    <path d="M10 0 L20 10 M30 0 L40 10 M50 0 L60 10 M70 0 L80 10 M90 0 L100 10 M110 0 L120 10 M130 0 L140 10 M150 0 L160 10 M170 0 L180 10 M190 0 L200 10 M210 0 L220 10 M230 0 L240 10 M250 0 L260 10 M270 0 L280 10 M290 0 L300 10 M310 0 L320 10" stroke="#18181B" stroke-width="4"/>
  </g>

  <!-- Badge -->
  <rect x="145" y="88" width="175" height="14" rx="2" fill="#B91C1C"/>
  <text x="232" y="98.5" text-anchor="middle" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="7.6" font-weight="800">25 HOSTAGES HELD · SIEGE INTO WED</text>
</svg>"""


def svg_lead3_ukraine() -> str:
    return """<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ukr-grad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#7F1D1D" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#EF4444" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="326" height="104" fill="#1A1215"/>
  <line x1="10" y1="34" x2="316" y2="34" stroke="#2D1F24" stroke-width="0.8"/>
  <line x1="10" y1="56" x2="316" y2="56" stroke="#2D1F24" stroke-width="0.8"/>
  <line x1="10" y1="78" x2="316" y2="78" stroke="#2D1F24" stroke-width="0.8"/>
  
  <!-- Top banner -->
  <rect x="0" y="0" width="220" height="20" fill="#B91C1C"/>
  <text x="110" y="14" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900" letter-spacing="0.04em">UKRAINE WAR TOLL · RFE/RL ANALYSIS</text>

  <!-- Area curve 2022 -> 2026 -->
  <path d="M15 84 L65 77 L125 68 L195 53 L260 38 L310 25 L310 88 L15 88 Z" fill="url(#ukr-grad)"/>
  <path d="M15 84 L65 77 L125 68 L195 53 L260 38 L310 25" stroke="#EF4444" stroke-width="2.5" fill="none"/>
  <circle cx="310" cy="25" r="4" fill="#FCA5A5" stroke="#FFF" stroke-width="1.2"/>

  <!-- Timeline markers -->
  <g font-family="'Inter', sans-serif" font-size="7.5" font-weight="700" fill="#9CA3AF">
    <text x="18" y="97">2022</text>
    <text x="120" y="97">2024</text>
    <text x="250" y="97">NOV 2026</text>
  </g>

  <!-- Shock callout -->
  <rect x="145" y="44" width="165" height="20" rx="3" fill="#0F172A" stroke="#EF4444" stroke-width="1.2"/>
  <text x="227" y="58" text-anchor="middle" fill="#F87171" font-family="'Georgia', serif" font-size="11" font-weight="900">700,000+ KILLED</text>
</svg>"""


def make_feat_banner_svg(banner: str, bg_col: str, center_markup: str) -> str:
    return f"""<svg viewBox="0 0 192 67" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="67" fill="{bg_col}"/>
  <rect x="0" y="0" width="192" height="15" fill="#000000" opacity="0.3"/>
  <text x="8" y="11" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="8.2" font-weight="900" letter-spacing="0.05em">{escape(banner)}</text>
  {center_markup}
</svg>"""


# Features 4-13 SVGs
def svg_feat4_aus_cpi() -> str:
    markup = """
    <path d="M15 52 L60 48 L110 38 L165 24" stroke="#FCA5A5" stroke-width="2.2" fill="none"/>
    <circle cx="165" cy="24" r="3.5" fill="#EF4444" stroke="#FFF" stroke-width="1"/>
    <g font-family="'Inter', sans-serif" font-size="8" font-weight="800">
      <text x="15" y="62" fill="#E2E8F0">4.3% SEP</text>
      <text x="115" y="62" fill="#F87171">4.9% OCT</text>
    </g>
    <!-- Lightning bolt + tag -->
    <polygon points="120,20 128,20 124,28 132,28 122,40 125,30 118,30" fill="#FBBF24"/>
    <rect x="135" y="24" width="52" height="14" rx="2" fill="#000" opacity="0.6"/>
    <text x="161" y="34.5" text-anchor="middle" fill="#FBBF24" font-family="'Inter', sans-serif" font-size="7.2" font-weight="900">+25.2% ELEC</text>
    """
    return make_feat_banner_svg("AUSTRALIA CPI 4.9%", "#7F1D1D", markup)


def svg_feat5_asia_markets() -> str:
    markup = """
    <g font-family="'Consolas', monospace" font-size="8.2" font-weight="700">
      <rect x="10" y="20" width="80" height="18" rx="2" fill="#1E293B"/>
      <text x="14" y="32" fill="#FCA5A5">-5.86% NVDA</text>
      
      <rect x="98" y="20" width="84" height="18" rx="2" fill="#1E293B"/>
      <text x="102" y="32" fill="#FCA5A5">-2.6% NIKKEI</text>

      <rect x="10" y="42" width="80" height="18" rx="2" fill="#1E293B"/>
      <text x="14" y="54" fill="#FCA5A5">-6.7% TAIEX</text>

      <rect x="98" y="42" width="84" height="18" rx="2" fill="#1E293B"/>
      <text x="102" y="54" fill="#34D399">GOLD $3,545</text>
    </g>
    """
    return make_feat_banner_svg("ASIA WED MARKETS", "#0F172A", markup)


def svg_feat6_nato() -> str:
    markup = """
    <!-- NATO 4-point compass star -->
    <g transform="translate(45, 40)">
      <circle cx="0" cy="0" r="14" stroke="#60A5FA" stroke-width="1.5" fill="none"/>
      <polygon points="0,-18 3,-4 18,0 3,4 0,18 -3,4 -18,0 -3,-4" fill="#FFFFFF"/>
    </g>
    <rect x="85" y="24" width="95" height="16" rx="2" fill="#1E293B"/>
    <text x="132" y="35.5" text-anchor="middle" fill="#93C5FD" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800">PALM BEACH, FL</text>
    <rect x="85" y="44" width="95" height="16" rx="2" fill="#1E293B"/>
    <text x="132" y="55.5" text-anchor="middle" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800">TRUMP · RUTTE TALKS</text>
    """
    return make_feat_banner_svg("USA · NATO TALKS", "#1E3A8A", markup)


def svg_feat7_pce_gdp() -> str:
    markup = """
    <!-- Clock dial -->
    <g transform="translate(38, 41)">
      <circle cx="0" cy="0" r="15" fill="#0F172A" stroke="#94A3B8" stroke-width="1.5"/>
      <line x1="0" y1="0" x2="0" y2="-9" stroke="#38BDF8" stroke-width="2"/>
      <line x1="0" y1="0" x2="6" y2="6" stroke="#38BDF8" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="2" fill="#FFF"/>
    </g>
    <rect x="68" y="22" width="112" height="18" rx="2" fill="#0F172A"/>
    <text x="124" y="34.5" text-anchor="middle" fill="#F8FAFC" font-family="'Inter', sans-serif" font-size="8.5" font-weight="900">13:30 GMT RELEASE</text>
    <rect x="68" y="43" width="112" height="17" rx="2" fill="#0F172A"/>
    <text x="124" y="55" text-anchor="middle" fill="#38BDF8" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800">96.4% FED DEC HIKE</text>
    """
    return make_feat_banner_svg("US PCE & Q3 GDP", "#1E293B", markup)


def svg_feat8_shanghai() -> str:
    markup = """
    <!-- Skyline silhouette -->
    <polygon points="10,62 18,48 24,48 24,62 30,36 34,36 36,62 44,22 47,22 49,62 55,42 62,42 64,62" fill="#991B1B"/>
    <rect x="75" y="24" width="108" height="34" rx="2" fill="#450A0A" stroke="#DC2626" stroke-width="1"/>
    <text x="129" y="37" text-anchor="middle" fill="#FEF2F2" font-family="'Georgia', serif" font-size="8.5" font-weight="900">JIEFANG DAILY WED</text>
    <text x="129" y="50" text-anchor="middle" fill="#FCA5A5" font-family="'Inter', sans-serif" font-size="7" font-weight="700">PARTY PLEDGES LOYALTY</text>
    """
    return make_feat_banner_svg("SHANGHAI LOYALTY", "#7F1D1D", markup)


def svg_feat9_un_16days() -> str:
    markup = """
    <!-- Ribbon motif -->
    <g transform="translate(36, 41)">
      <circle cx="0" cy="0" r="14" fill="#3B0764" stroke="#D8B4FE" stroke-width="1"/>
      <path d="M-6 -8 C-2 -14 2 -14 6 -8 C10 0 12 10 14 14 L9 15 L0 3 L-9 15 L-14 14 C-12 10 -10 0 -6 -8 Z" fill="#FB923C"/>
    </g>
    <rect x="66" y="22" width="115" height="18" rx="2" fill="#3B0764"/>
    <text x="123.5" y="34.5" text-anchor="middle" fill="#FB923C" font-family="'Inter', sans-serif" font-size="8.2" font-weight="900">16 DAYS · NOV 25</text>
    <rect x="66" y="43" width="115" height="17" rx="2" fill="#3B0764"/>
    <text x="123.5" y="55" text-anchor="middle" fill="#E9D5FF" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800">47,000 VICTIMS / 2025</text>
    """
    return make_feat_banner_svg("UN 16 DAYS OPENS", "#581C87", markup)


def svg_feat10_shein() -> str:
    markup = """
    <!-- Garment tag + gavel -->
    <g transform="translate(35, 41) rotate(-15)">
      <polygon points="0,-14 16,-14 22,-5 22,14 0,14" fill="#FFF" stroke="#431407" stroke-width="1"/>
      <circle cx="6" cy="-6" r="2.5" fill="#7C2D12"/>
      <text x="11" y="7" text-anchor="middle" fill="#7C2D12" font-family="'Inter', sans-serif" font-size="6.5" font-weight="900">SHEIN</text>
    </g>
    <rect x="72" y="24" width="110" height="34" rx="2" fill="#431407" stroke="#EA580C" stroke-width="1"/>
    <text x="127" y="38" text-anchor="middle" fill="#FED7AA" font-family="'Georgia', serif" font-size="9" font-weight="900">$100M SETTLEMENT</text>
    <text x="127" y="50" text-anchor="middle" fill="#FDBA74" font-family="'Inter', sans-serif" font-size="7" font-weight="700">FTC DECEPTIVE PRACTICES</text>
    """
    return make_feat_banner_svg("SHEIN $100M FTC", "#7C2D12", markup)


def svg_feat11_soldier() -> str:
    markup = """
    <!-- Classified folder & padlock -->
    <g transform="translate(35, 40)">
      <rect x="-16" y="-12" width="32" height="24" rx="2" fill="#334155" stroke="#94A3B8" stroke-width="1"/>
      <rect x="-16" y="-12" width="12" height="6" fill="#475569"/>
      <polygon points="0,-5 3,3 -5,-2 5,-2 -3,3" fill="#F59E0B"/>
    </g>
    <rect x="68" y="23" width="114" height="17" rx="2" fill="#0F172A"/>
    <text x="125" y="34.5" text-anchor="middle" fill="#EF4444" font-family="'Inter', sans-serif" font-size="7.5" font-weight="900">CLASSIFIED INTEL SALE</text>
    <rect x="68" y="43" width="114" height="17" rx="2" fill="#0F172A"/>
    <text x="125" y="54.5" text-anchor="middle" fill="#CBD5E1" font-family="'Inter', sans-serif" font-size="6.9" font-weight="700">GUILTY PLEA - UP TO 10 YEARS</text>
    """
    return make_feat_banner_svg("MILITARY ESPIONAGE", "#1E293B", markup)


def svg_feat12_india_eu() -> str:
    markup = """
    <!-- Ashoka wheel + EU stars -->
    <g transform="translate(36, 41)">
      <circle cx="0" cy="0" r="13" stroke="#34D399" stroke-width="1.2" fill="none"/>
      <line x1="-13" y1="0" x2="13" y2="0" stroke="#34D399" stroke-width="1"/>
      <line x1="0" y1="-13" x2="0" y2="13" stroke="#34D399" stroke-width="1"/>
      <line x1="-9" y1="-9" x2="9" y2="9" stroke="#34D399" stroke-width="1"/>
      <line x1="-9" y1="9" x2="9" y2="-9" stroke="#34D399" stroke-width="1"/>
    </g>
    <rect x="68" y="23" width="114" height="17" rx="2" fill="#064E3B"/>
    <text x="125" y="34.5" text-anchor="middle" fill="#6EE7B7" font-family="'Inter', sans-serif" font-size="7.8" font-weight="900">BILATERAL TRADE PACT</text>
    <rect x="68" y="43" width="114" height="17" rx="2" fill="#064E3B"/>
    <text x="125" y="54.5" text-anchor="middle" fill="#ECFDF5" font-family="'Inter', sans-serif" font-size="7.3" font-weight="700">SIGNING IN DECEMBER</text>
    """
    return make_feat_banner_svg("INDIA · EU PACT", "#065F46", markup)


def svg_feat13_shortwave() -> str:
    markup = """
    <!-- Radio tower with arcs -->
    <g transform="translate(32, 43)">
      <line x1="0" y1="-14" x2="0" y2="15" stroke="#93C5FD" stroke-width="1.8"/>
      <polygon points="-8,15 0,-14 8,15" fill="none" stroke="#93C5FD" stroke-width="1"/>
      <circle cx="0" cy="-14" r="2.5" fill="#F59E0B"/>
      <!-- Radiating arcs -->
      <path d="M-6 -18 A10 10 0 0 1 6 -18" stroke="#60A5FA" stroke-width="1.2" fill="none"/>
      <path d="M-10 -22 A15 15 0 0 1 10 -22" stroke="#60A5FA" stroke-width="1.2" fill="none"/>
    </g>
    <rect x="58" y="21" width="124" height="17" rx="2" fill="#0F172A"/>
    <text x="120" y="32.5" text-anchor="middle" fill="#38BDF8" font-family="'Inter', sans-serif" font-size="7.6" font-weight="900">SHORTWAVE 01:00 UTC</text>
    <rect x="58" y="42" width="124" height="18" rx="2" fill="#B91C1C"/>
    <text x="120" y="54" text-anchor="middle" fill="#FFFFFF" font-family="'Inter', sans-serif" font-size="7.2" font-weight="800">LESSONS FOR AFGHAN GIRLS</text>
    """
    return make_feat_banner_svg("RFE/RL SHORTWAVE", "#1E3A8A", markup)


LEAD_CARDS = [
    {
        "num": "1",
        "kicker": "COURTS · GLOBAL TECH",
        "svg": svg_lead1_huawei(),
        "hl": "US JURY CONVICTS HUAWEI ON 10 OF 12 FRAUD, SANCTIONS & TRADE-SECRET COUNTS",
        "body": "A federal jury in Brooklyn (Tue in New York, Wed in Asia) convicted Huawei Technologies on 10 of 12 felony counts—bank and wire fraud, Iran sanctions violations, and trade-secret theft conspiracy—after a 12-week trial; sentencing is 14 Sep 2027.",
        "src": "Reuters / DOJ / SCMP",
    },
    {
        "num": "2",
        "kicker": "CRISIS · COLOMBIA",
        "svg": svg_lead2_colombia(),
        "hl": "GUNMEN HOLD 25 HOSTAGES IN CARTAGENA SUPERMARKET SIEGE AFTER ARMOURED-TRUCK RAID",
        "body": "Robbers fleeing a botched armoured-truck raid seized ~30 hostages inside a Cartagena Éxito supermarket (Tue afternoon in Cartagena — Wed in Asia). Snipers sealed the area; 10 hostages were freed by 00:57 UTC Wednesday as the siege continued.",
        "src": "AP / AFP / Sky",
    },
    {
        "num": "3",
        "kicker": "CONFLICT · UKRAINE WAR",
        "svg": svg_lead3_ukraine(),
        "hl": "NEW RFE/RL ANALYSIS ESTIMATES OVER 700,000 RUSSIAN SOLDIERS KILLED IN UKRAINE WAR",
        "body": "A new analysis published Wednesday at 01:00 UTC by Radio Free Europe/Radio Liberty estimates that more than 700,000 Russian soldiers have been killed since the full-scale invasion of Ukraine began in February 2022.",
        "src": "RFE/RL",
    },
]

FEATURE_CARDS = [
    (
        "4",
        "ECONOMY · AUSTRALIA",
        svg_feat4_aus_cpi(),
        "AUSTRALIA OCTOBER CPI JUMPS TO 4.9% Y/Y AS ELECTRICITY COSTS SURGE +25.2%",
        "Australian Bureau of Statistics data released Wednesday at 00:30 GMT showed October CPI jumping to 4.9% y/y from 4.3% in September (above 4.8% forecast) and trimmed mean rising to 3.8%, driven by electricity +25.2%, transport +10.6%, and housing +6.4%, putting a December RBA hike above 4.85% back in play.",
        "ABS / WSJ / FXStreet",
    ),
    (
        "5",
        "MARKETS · ASIA-PACIFIC",
        svg_feat5_asia_markets(),
        "ASIA MARKETS FALL WEDNESDAY; NIKKEI -2.6%, TAIEX -6.7% AS AI RALLY FADES",
        "Asian markets fell Wednesday (Nikkei -2.6%, Taiex -6.7%, KOSPI -4.5%) after Nvidia slid -5.86% Tuesday in New York (Tue NY, Wed Asia). Gold held at $3,544.54/oz Wed 00:24 GMT; a Dec 25bp Fed hike is priced at 96.4%.",
        "Reuters 24-25 Nov",
    ),
    (
        "6",
        "DIPLOMACY · USA / NATO",
        svg_feat6_nato(),
        "TRUMP MEETS NATO CHIEF MARK RUTTE WEDNESDAY IN FLORIDA FOR ALLIANCE TALKS",
        "Donald Trump meets Wednesday in Florida with NATO Secretary General Mark Rutte for bilateral discussions on alliance defence commitments.",
        "Reuters / SCMP",
    ),
    (
        "7",
        "ECONOMY · UNITED STATES",
        svg_feat7_pce_gdp(),
        "US OCT PCE INFLATION & Q3 GDP SECOND ESTIMATE AWAITED WEDNESDAY AT 13:30 GMT",
        "Global markets position as US October PCE inflation and the second estimate of Q3 GDP are awaited Wednesday at 13:30 GMT ahead of the Federal Reserve's December policy meeting.",
        "Reuters",
    ),
    (
        "8",
        "POLITICS · CHINA",
        svg_feat8_shanghai(),
        "SHANGHAI PARTY PLEDGES LOYALTY TO BEIJING WEDNESDAY AFTER CHIEF CHEN JINING PROBED",
        "Shanghai's municipal party committee pledged loyalty to Beijing on the Wednesday front page of Jiefang Daily, hours after Xinhua announced Tuesday evening that Shanghai party chief and Politburo member Chen Jining was placed under investigation (first Shanghai chief probed since 2006; Tuesday probe is context only).",
        "Reuters / CNN",
    ),
    (
        "9",
        "HUMAN RIGHTS · UN / AFRICA",
        svg_feat9_un_16days(),
        "UN OPENS 16 DAYS CAMPAIGN AGAINST GENDER VIOLENCE WEDNESDAY; 47,000 KILLED IN 2025",
        "The UN's 16 Days of Activism against Gender-Based Violence opened Wednesday (25 Nov, International Day for the Elimination of Violence against Women). A UN Women/UNODC brief published Tuesday found 47,000 women and girls were killed by partners or relatives in 2025 — 129 a day, five an hour, with Africa recording the highest regional toll.",
        "UN Women / UNODC",
    ),
    (
        "10",
        "TECH LAW · UNITED STATES",
        svg_feat10_shein(),
        "FAST-FASHION RETAILER SHEIN TO PAY $100M TO SETTLE US FTC DECEPTIVE-PRACTICES CLAIMS",
        "Fast-fashion retailer Shein agreed to pay $100 million to settle Federal Trade Commission allegations of deceptive practices.",
        "Manila Times / FTC",
    ),
    (
        "11",
        "SECURITY · UNITED STATES",
        svg_feat11_soldier(),
        "US ARMY SOLDIER PLEADS GUILTY TO SELLING CLASSIFIED MILITARY INTEL TO CHINESE BUYERS",
        "A US soldier admitted in federal court to selling sensitive military information to buyers in China, the Justice Department said.",
        "Manila Times / DOJ",
    ),
    (
        "12",
        "TRADE · INDIA / EU",
        svg_feat12_india_eu(),
        "INDIA AND EUROPEAN UNION LIKELY TO SIGN BILATERAL FREE TRADE PACT IN DECEMBER",
        "Officials reported Wednesday that India and the European Union are likely to sign a bilateral trade agreement in December.",
        "NDTV",
    ),
    (
        "13",
        "MEDIA · AFGHANISTAN",
        svg_feat13_shortwave(),
        "RFE/RL RETURNS TO SHORTWAVE WEDNESDAY WITH LESSONS FOR AFGHAN GIRLS",
        "Radio Free Europe/Radio Liberty returned to shortwave radio Wednesday (01:00 UTC) with new educational broadcasts for Afghan girls excluded from school by the Taliban.",
        "RFE/RL",
    ),
]

BRIEFS: list[tuple[str, str, str, str]] = [
    ("14", "Tokyo", "Reuters poll published Wednesday projects the Nikkei 225 reaching 65,000 by June 2027 and 67,500 by year-end after Tuesday's 58,644.63 close.", "Reuters"),
    ("15", "Washington", "Trump administration Section 301 excess-capacity probe findings and new tariffs on 16 partners including China, EU, India, Japan, Korea, and Vietnam due Wednesday.", "Reuters"),
    ("16", "Ankara", "Turkish Air Force helicopter crashes on a training flight near Eskisehir, killing five crew (Tue evening — Wed in Asia).", "Reuters"),
    ("17", "Beijing", "China launches Shenzhou-24 crewed spacecraft Wednesday, carrying Pakistan's first astronaut to the Tiangong space station.", "CGTN"),
    ("18", "Paris", "Gisèle Pelicot slams publisher for using nude images from her rape trial in book promo (Tue evening Paris — Wed in Asia).", "SCMP"),
    ("19", "Madrid", "Real Madrid hammer PSV Eindhoven 5-1 in the Champions League as Bellingham scores a stunner; Arsenal and Man City held to draws (Tue night Europe — Wed in Asia).", "AFP / Dawn"),
    ("20", "Taipei", "Taiwan shares open lower Wednesday, Taiex down 138 points at the open after Wall Street's tech slide.", "Focus Taiwan"),
    ("21", "Sydney", "ASX 200 slips 0.9% Wednesday as 4.9% CPI print revives December RBA hike bets above 4.85% cash rate.", "ABS / Reuters"),
    ("22", "London", "British police arrest two men after a break-in at Prince William's Norfolk home (Tue evening — Wed in Asia).", "AFP / SCMP"),
    ("23", "Kinshasa", "Cobalt firms race to beat DR Congo's export ban on battery material ahead of November 30 ban deadline.", "SCMP"),
    ("24", "Seoul", "Washington reaffirms alliance cooperation after Seoul's cabinet reshuffle naming new foreign, unification and spy chiefs.", "Korea Herald"),
    ("25", "Riyadh", "Houthi strike on Riyadh PIF tower wounds 11 people, Saudi media report (Tue night Riyadh — Wed in Sydney).", "Reuters / JPost"),
    ("26", "California", "Extreme flooding threatens northern and central California as king tides peak Wednesday.", "Manila Times / Reuters"),
    ("27", "Beirut", "Lebanon border ceasefire monitoring and regional maritime security talks continue on Wednesday, diplomats say.", "Reuters"),
    ("28", "Seoul", "Seoul Metro unions reach a last-minute wage deal Wednesday, averting a planned general strike on the capital's subway.", "Yonhap"),
    ("29", "Khartoum", "UN agencies warn Wednesday of deepening Sudan displacement and acute aid shortages across Darfur camps.", "UN / Reuters"),
    ("30", "Tokyo", "South Korea's parliamentary leader meets Japan's prime minister in Tokyo on Wednesday.", "Yonhap"),
    ("31", "London", "Bank of England officials including Governor Andrew Bailey due Wednesday before Parliament's Treasury Committee.", "Reuters"),
    ("32", "Washington", "US Treasury $44bn 7-year note auction due Wednesday as bond markets await October PCE data.", "Reuters"),
    ("33", "Mumbai", "Indian equity markets resume trading Wednesday after Guru Nanak Jayanti holiday, with GIFT Nifty mildly higher.", "ET Now / Moneycontrol"),
    ("34", "Washington", "Trump awards Rudy Giuliani the Medal of Freedom, the highest US civilian honour, in a private Oval Office ceremony (Tue afternoon Washington — Wed in Asia).", "AP / SCMP"),
    ("35", "Gaza", "UN relief agencies warn Wednesday of acute winter shelter and fuel shortages across displaced Gaza camps.", "UN / Reuters"),
]

MAP_PINS: list[tuple[str, float, float, bool]] = [
    ("1", 87.0, 37.4, True),
    ("2", 81.9, 71.6, True),
    ("3", 164.9, 30.4, True),
    ("4", 257.8, 118.6, False),
    ("5", 250.5, 45.6, False),
    ("6", 78.3, 56.6, False),
    ("7", 76.2, 44.8, False),
    ("8", 236.2, 50.2, False),
    ("9", 145.8, 34.8, False),
    ("10", 45.9, 45.8, False),
    ("11", 59.1, 51.1, False),
    ("12", 201.5, 52.9, False),
    ("13", 191.2, 43.3, False),
]


def build_world_map_svg() -> str:
    # N1 — Continent vectors sourced from own 20 Nov entry (lines 336-348)
    land_paths = [
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
    polys = "\n    ".join(
        f'<path d="{p}" fill="#DFD7C2" stroke="#9D9278" stroke-width="0.6" stroke-linejoin="round"/>'
        for p in land_paths
    )

    pins = []
    # Render features 4-13 first
    for num, cx, cy, is_lead in MAP_PINS:
        if not is_lead:
            pins.append(
                f'<circle cx="{cx}" cy="{cy}" r="5.3" fill="#1D4ED8" stroke="#FFF" stroke-width="0.9"/>'
                f'<text x="{cx}" y="{cy + 2.1}" text-anchor="middle" fill="#FFF" font-family="\'Inter\', sans-serif" font-size="6.1" font-weight="800">{num}</text>'
            )
    # Render leads 1-3 on top
    for num, cx, cy, is_lead in MAP_PINS:
        if is_lead:
            pins.append(
                f'<circle cx="{cx}" cy="{cy}" r="6.4" fill="#B91C1C" stroke="#FFF" stroke-width="1.0"/>'
                f'<text x="{cx}" y="{cy + 2.4}" text-anchor="middle" fill="#FFF" font-family="\'Inter\', sans-serif" font-size="7.2" font-weight="800">{num}</text>'
            )

    return f"""<svg viewBox="0 0 282 144" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="282" height="144" fill="#EFECE2" stroke="#C8BFA8" stroke-width="0.8"/>
    {polys}
    {"".join(pins)}
  </svg>"""


def build_html() -> str:
    kpi_html = "\n".join(
        f"""      <div class="kpi-item">
        <div class="kpi-val" style="color:{color}">{escape(val)}</div>
        <div class="kpi-lbl">{escape(lbl)}</div>
      </div>"""
        for val, lbl, color in KPIS
    )

    region_segs = "\n".join(
        f'        <div class="reg-seg" style="width:{pct}%; background:{col};">{escape(reg)} {cnt}</div>'
        for reg, cnt, col, pct in REGIONS
    )

    leads_html = "\n".join(
        f"""      <article class="lead-card">
        <div class="lead-art">{c["svg"]}</div>
        <div class="kicker-line">
          <span class="npill np-lead">{c["num"]}</span>
          <span class="kicker-txt">{escape(c["kicker"])}</span>
        </div>
        <h2 class="lead-hl">{escape(c["hl"])}</h2>
        <p class="lead-body">{escape(c["body"])} <span class="src">({escape(c["src"])})</span></p>
      </article>"""
        for c in LEAD_CARDS
    )

    feats_html = "\n".join(
        f"""      <article class="feat-card">
        <div class="feat-art">{svg}</div>
        <div class="kicker-sm">
          <span class="npill np-feat">{num}</span>
          <span class="kicker-txt">{escape(kicker)}</span>
        </div>
        <h3 class="feat-hl">{escape(hl)}</h3>
        <p class="feat-body">{escape(body)} <span class="src">({escape(src)})</span></p>
      </article>"""
        for num, kicker, svg, hl, body, src in FEATURE_CARDS
    )

    col1, col2 = BRIEFS[:11], BRIEFS[11:]

    def render_bcol(items: list[tuple[str, str, str, str]]) -> str:
        return "\n".join(
            f'<div class="brow"><span class="bnum">{n}</span><b>{escape(loc)}</b> {escape(txt)} <span class="bsrc">({escape(src)})</span></div>'
            for n, loc, txt, src in items
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Wednesday 25 November 2026</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{
    width: 1024px; height: 1024px; overflow: hidden;
    background: #F5F1E8; color: #111827;
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .page {{
    width: 1024px; height: 1024px;
    padding: 8px 17px 7px 17px;
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .top-bar {{
    display: flex; justify-content: space-between;
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em;
    color: #B91C1C; padding-bottom: 2px; border-bottom: 2px solid #111827;
  }}
  .top-right {{ color: #111827; }}
  .masthead {{ text-align: center; border-bottom: 1.5px solid #111827; padding: 1px 0 2px 0; }}
  .masthead h1 {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 56px; line-height: 0.96; font-weight: 900; letter-spacing: -0.025em; color: #0F172A;
  }}
  .deck {{
    font-family: 'Georgia', 'Times New Roman', serif; font-style: italic;
    font-size: 12px; color: #334155; margin-top: 2px;
  }}
  .kpi-row {{
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
    padding: 3px 0; border-bottom: 1px solid #C8BFA8;
  }}
  .kpi-item {{ border-left: 2px solid #94A3B8; padding-left: 7px; }}
  .kpi-item:first-child {{ border-left: none; padding-left: 0; }}
  .kpi-val {{ font-family: 'Georgia', 'Times New Roman', serif; font-size: 19px; font-weight: 900; line-height: 1.02; }}
  .kpi-lbl {{ font-size: 8.2px; line-height: 1.13; color: #334155; font-weight: 600; margin-top: 1px; }}
  .reg-bar {{ display: flex; height: 15px; margin-top: 2px; border-radius: 2px; overflow: hidden; }}
  .reg-seg {{
    color: #FFF; font-size: 8.3px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; letter-spacing: 0.03em;
  }}
  .lead-grid {{
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin-top: 3px; padding-bottom: 4px; border-bottom: 1.5px solid #111827;
  }}
  .lead-card {{ display: flex; flex-direction: column; gap: 3px; }}
  .lead-art {{ width: 100%; height: 104px; overflow: hidden; }}
  .kicker-line {{
    font-size: 8.3px; font-weight: 800; color: #B91C1C; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 4px;
  }}
  .kicker-txt {{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .npill {{
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%; color: #FFF; font-weight: 800; flex-shrink: 0;
  }}
  .np-lead {{ width: 14px; height: 14px; font-size: 8.5px; background: #B91C1C; }}
  .np-feat {{ width: 13px; height: 13px; font-size: 7.5px; background: #1D4ED8; }}
  .lead-hl {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 14.6px; line-height: 1.12; font-weight: 900; color: #0F172A;
    max-height: 55px; overflow: hidden;
  }}
  .lead-body {{
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 8.7px; line-height: 1.17; color: #1E293B;
    max-height: 48px; overflow: hidden;
  }}
  .src {{ color: #64748B; font-style: italic; font-weight: 600; }}
  .feat-grid {{
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
    margin-top: 3px; padding-bottom: 4px; border-bottom: 1.5px solid #111827;
  }}
  .feat-card {{ display: flex; flex-direction: column; gap: 2px; }}
  .feat-art {{ width: 100%; height: 67px; overflow: hidden; }}
  .kicker-sm {{
    font-size: 7.3px; font-weight: 800; color: #1E40AF; letter-spacing: 0.02em;
    display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden;
  }}
  .feat-hl {{
    font-family: 'Georgia', 'Times New Roman', 'DejaVu Serif', serif;
    font-size: 9.6px; line-height: 1.05; font-weight: 900; color: #0F172A;
    max-height: 30px; overflow: hidden;
  }}
  .feat-body {{
    font-family: 'Inter', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 7.0px; line-height: 1.12; color: #334155;
    max-height: 32px; overflow: hidden;
  }}
  .bottom-band {{
    display: grid; grid-template-columns: 282px 1fr; gap: 12px; margin-top: 2px;
  }}
  .sec-h {{
    font-size: 8.8px; font-weight: 900; letter-spacing: 0.05em; color: #0F172A;
    margin-bottom: 2px; display: flex; justify-content: space-between;
  }}
  .map-wrap {{ width: 282px; height: 144px; overflow: hidden; border-radius: 2px; }}
  .map-cap {{ font-size: 7.3px; color: #475569; margin-top: 2px; font-weight: 600; }}
  .bcols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
  .brow {{ font-size: 7.8px; line-height: 1.18; color: #1E293B; margin-bottom: 1.0px; }}
  .bnum {{
    display: inline-block; min-width: 13px; text-align: center;
    background: #1E3A8A; color: #FFF; font-size: 6.8px; font-weight: 800;
    border-radius: 2px; margin-right: 2px; padding: 0 1px;
  }}
  .bsrc {{ color: #64748B; font-size: 7.0px; }}
  .date-check {{
    border: 1.4px solid #B91C1C; background: #FEF2F2; color: #7F1D1D;
    font-size: 7.2px; line-height: 1.16; padding: 2.5px 6px;
  }}
  .date-check b {{ color: #991B1B; letter-spacing: 0.03em; }}
  .colophon {{
    display: flex; justify-content: space-between;
    font-size: 7.4px; color: #475569; font-weight: 600;
    padding-top: 2px;
  }}
</style>
</head>
<body>
  <div class="page">
    <header>
      <div class="top-bar">
        <span>THE WORLD IN ONE DAY</span>
        <span class="top-right">35 SOURCED STORIES · 6 CONTINENTS</span>
      </div>
      <div class="masthead">
        <h1>Wednesday 25 November 2026</h1>
        <p class="deck">Huawei convicted 10/12 · Cartagena 25-hostage siege · Aus CPI 4.9%</p>
      </div>
      <div class="kpi-row">
{kpi_html}
      </div>
      <div class="reg-bar">
{region_segs}
      </div>
    </header>

    <section class="lead-grid">
{leads_html}
    </section>

    <section class="feat-grid">
{feats_html}
    </section>

    <section class="bottom-band">
      <div>
        <div class="sec-h"><span>WHERE IT HAPPENED</span><span style="color:#64748B;">PINS 1–13</span></div>
        <div class="map-wrap">{build_world_map_svg()}</div>
        <div class="map-cap">Each pin marks a featured story (1–13) on this page.</div>
      </div>
      <div>
        <div class="sec-h"><span>ALSO ON WEDNESDAY 25 NOVEMBER — 22 MORE STORIES</span><span style="color:#64748B;">WORLD BRIEFS 14–35</span></div>
        <div class="bcols">
          <div>{render_bcol(col1)}</div>
          <div>{render_bcol(col2)}</div>
        </div>
      </div>
    </section>

    <footer>
      <div class="date-check">
        <b>DATE DISCIPLINE (WED 25 NOV ONLY — EXCLUDED PRIOR-DAY EVENTS):</b> Events count if they occurred or broke on 25 Nov 2026 in any timezone (≥13:00 UTC Tue = Wed 25 Nov in Sydney/Tokyo; tagged inline). Excluded Tue 24 Nov daytime &amp; earlier stories: Asia Tue rally (Taiwan +9.1%, KOSPI +7.5%), Korea Ulleung scramble, Gaza Khan Younis strike (3 killed) &amp; Hamas security chief Naim Abu Nahal killing, Hanoi eatery blast (6 killed), Nepal M5.3 quake, IRGC Hormuz mines, Sarkozy trial order, Mon 23 Nov Nvidia +31.5% surge, NATO Poland AWACS, Libya warship strike, and Sun 22 Nov COP31 collapse. In #8 &amp; #9, Tue's Chen Jining probe and UN femicide report are prior-day context only.
      </div>
      <div class="colophon">
        <span>Every story happened or was first reported on Wednesday 25 November 2026. Officials' counts &amp; claims attributed.</span>
        <span>Sources: Reuters · AP · AFP · SCMP · FTC · DOJ · RFE/RL · ABS · Focus Taiwan · Yonhap · CGTN · Original drawings</span>
      </div>
    </footer>
  </div>
</body>
</html>
"""


def render_broadsheet() -> None:
    HTML_PATH.write_text(build_html(), encoding="utf-8")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
        # M5 — Playwright font readiness sync
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
    img.resize((300, 300), Image.Resampling.LANCZOS).save(PREVIEW_300_PATH, format="PNG", optimize=True)
    print(f"Rendered {PNG_PATH} ({png_size} bytes, 1024x1024 RGB PNG)")
    print(f"Rendered {PREVIEW_300_PATH} ({PREVIEW_300_PATH.stat().st_size} bytes, 300x300)")


if __name__ == "__main__":
    render_broadsheet()
