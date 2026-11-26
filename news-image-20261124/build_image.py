from __future__ import annotations
from html import escape
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent
HTML_PATH = OUTPUT_DIR / "broadsheet.html"
PNG_PATH = OUTPUT_DIR / "entry.png"
PREVIEW_300_PATH = OUTPUT_DIR / "preview_300.png"

# Quantitative Shock Strip: 6 verified Tuesday 24 Nov figures
KPIS: list[tuple[str, str, str]] = [
    ("+9.1%", "ASIA TECH RALLY · TAIWAN LEADS ASIA REBOUND", "#047857"),
    ("3+", "GAZA STRIKE · KHAN YOUNIS CASUALTIES; ~2/3 CONTROLLED", "#B91C1C"),
    ("810,592", "US AUTO SAFETY · HONDA VEHICLES RECALLED (TAKATA)", "#1D4ED8"),
    ("180", "ZANZIBAR DISASTER · FOREIGN TOURISTS EVACUATED IN FIRE", "#B45309"),
    ("7.3M", "FOOD AID CRISIS · CIVILIANS AT RISK AS WAR DRAINS WFP", "#6D28D9"),
    ("4.1", "PAKISTAN QUAKE · MAGNITUDE 4.1 JOLTS NORTHERN REGION", "#0F766E"),
]

# Region Distribution Matrix: exactly 35 stories across 6 continents
REGIONS: list[tuple[str, int, str, float]] = [
    ("Europe", 7, "#1D4ED8", 20.0),
    ("Asia-Pacific", 11, "#B91C1C", 31.4),
    ("Americas", 8, "#6D28D9", 22.9),
    ("Africa", 4, "#047857", 11.4),
    ("Middle East", 3, "#B45309", 8.6),
    ("Oceania", 2, "#0F766E", 5.7),
]


def svg_markets() -> str:
    return """<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mkt-grad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#047857" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#10B981" stop-opacity="0.8"/>
    </linearGradient>
  </defs>
  <rect width="326" height="104" fill="#064E3B"/>
  <line x1="8" y1="34" x2="318" y2="34" stroke="#065F46" stroke-width="0.8"/>
  <line x1="8" y1="56" x2="318" y2="56" stroke="#065F46" stroke-width="0.8"/>
  <line x1="8" y1="78" x2="318" y2="78" stroke="#065F46" stroke-width="0.8"/>
  <path d="M12 88 L46 80 L84 72 L120 76 L158 54 L196 50 L234 32 L274 24 L314 16 L314 104 L12 104 Z" fill="url(#mkt-grad)"/>
  <path d="M12 88 L46 80 L84 72 L120 76 L158 54 L196 50 L234 32 L274 24 L314 16" stroke="#34D399" stroke-width="2.6" fill="none"/>
  <circle cx="314" cy="16" r="4" fill="#6EE7B7" stroke="#FFF" stroke-width="1.2"/>
  <rect x="0" y="0" width="168" height="23" fill="#047857"/>
  <text x="84" y="16" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="12" font-weight="900">AI TECH REBOUND</text>
  <g font-family="'Consolas', monospace" font-size="9" font-weight="700">
    <rect x="206" y="6" width="114" height="17" rx="2" fill="#0F172A" opacity="0.9"/>
    <text x="212" y="18" fill="#F8FAFC">Taiwan</text><text x="314" y="18" text-anchor="end" fill="#34D399">+9.1%</text>
    <rect x="206" y="27" width="114" height="17" rx="2" fill="#0F172A" opacity="0.9"/>
    <text x="212" y="39" fill="#F8FAFC">KOSPI</text><text x="314" y="39" text-anchor="end" fill="#34D399">+7.5%</text>
    <rect x="206" y="48" width="114" height="17" rx="2" fill="#0F172A" opacity="0.9"/>
    <text x="212" y="60" fill="#F8FAFC">Nikkei</text><text x="314" y="60" text-anchor="end" fill="#34D399">+4.5%</text>
  </g>
  <rect x="0" y="86" width="138" height="18" fill="#0F172A" opacity="0.92"/>
  <text x="69" y="98" text-anchor="middle" fill="#F8FAFC" font-family="'Inter', sans-serif" font-size="8" font-weight="700">MSCI Asia-Pac +4.6% · July High</text>
</svg>"""


def svg_korea() -> str:
    return """<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="326" height="104" fill="#0F172A"/>
  <g stroke="#0284C7" stroke-width="0.8" fill="none" opacity="0.45">
    <circle cx="163" cy="52" r="24"/>
    <circle cx="163" cy="52" r="48"/>
    <circle cx="163" cy="52" r="72"/>
    <line x1="163" y1="4" x2="163" y2="100"/>
    <line x1="8" y1="52" x2="318" y2="52"/>
  </g>
  <path d="M163 52 L225 18" stroke="#38BDF8" stroke-width="1.8" stroke-dasharray="4 2"/>
  <g transform="translate(230,34)">
    <circle r="14" fill="#EF4444" opacity="0.25"/>
    <circle r="8" fill="#EF4444" opacity="0.5"/>
    <circle r="3.5" fill="#EF4444" stroke="#FFF" stroke-width="1"/>
  </g>
  <text x="230" y="58" text-anchor="middle" fill="#FCA5A5" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800">Ulleung Is.</text>
  <path d="M110 74 L126 68 L122 72 L132 71 L124 75 L126 78 Z" fill="#94A3B8"/>
  <path d="M130 84 L146 78 L142 82 L152 81 L144 85 L146 88 Z" fill="#94A3B8"/>
  <rect x="0" y="0" width="168" height="23" fill="#B91C1C"/>
  <text x="84" y="16" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="12" font-weight="900">AIRSPACE SCRAMBLE</text>
  <rect x="206" y="6" width="114" height="17" rx="2" fill="#1E293B" opacity="0.95"/>
  <text x="263" y="18" text-anchor="middle" fill="#FDE047" font-family="'Consolas', monospace" font-size="8.2" font-weight="700">F-15K / KF-16 ALERT</text>
  <rect x="0" y="86" width="128" height="18" fill="#1E293B" opacity="0.92"/>
  <text x="64" y="98" text-anchor="middle" fill="#F8FAFC" font-family="'Inter', sans-serif" font-size="8" font-weight="700">Shelter Orders Issued</text>
</svg>"""


def svg_gaza() -> str:
    return """<svg viewBox="0 0 326 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="326" height="104" fill="#18181B"/>
  <path d="M0 90 L32 90 L32 76 L52 76 L52 90 L90 90 L90 68 L114 68 L114 90 L180 90 L180 72 L210 72 L210 90 L260 90 L260 62 L285 62 L285 90 L326 90 L326 104 L0 104 Z" fill="#27272A"/>
  <g transform="translate(142,62)">
    <circle r="32" fill="#EA580C" opacity="0.25"/>
    <circle r="20" fill="#DC2626" opacity="0.4"/>
    <circle r="10" fill="#FBBF24" opacity="0.75"/>
    <circle r="4" fill="#FFF"/>
  </g>
  <circle cx="142" cy="62" r="14" fill="none" stroke="#F87171" stroke-width="1.2" stroke-dasharray="3 3"/>
  <rect x="0" y="0" width="168" height="23" fill="#B91C1C"/>
  <text x="84" y="16" text-anchor="middle" fill="#FFF" font-family="'Inter', sans-serif" font-size="12" font-weight="900">KHAN YOUNIS STRIKE</text>
  <rect x="206" y="6" width="114" height="17" rx="2" fill="#27272A" opacity="0.95"/>
  <text x="263" y="18" text-anchor="middle" fill="#FDE047" font-family="'Consolas', monospace" font-size="8.2" font-weight="700">~2/3 GAZA CONTROLLED</text>
  <rect x="0" y="86" width="124" height="18" fill="#27272A" opacity="0.92"/>
  <text x="62" y="98" text-anchor="middle" fill="#F8FAFC" font-family="'Inter', sans-serif" font-size="8" font-weight="700">Police Outpost Target</text>
</svg>"""


def make_feat_svg(banner: str, banner_bg: str, badge_bot: str, inner_svg: str, bg: str = "#F8FAFC") -> str:
    return f"""<svg viewBox="0 0 192 67" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="67" fill="{bg}"/>
  {inner_svg}
  <rect x="0" y="0" width="144" height="17" fill="{banner_bg}"/>
  <text x="6" y="12.2" fill="#FFF" font-family="'Inter', sans-serif" font-size="9.5" font-weight="900">{escape(banner)}</text>
  <rect x="42" y="52" width="150" height="15" fill="#0F172A" opacity="0.9"/>
  <text x="117" y="62.5" text-anchor="middle" fill="#F8FAFC" font-family="'Inter', sans-serif" font-size="7.5" font-weight="700">{escape(badge_bot)}</text>
</svg>"""


LEAD_CARDS = [
    {
        "num": "1",
        "kicker": "MARKETS · ASIA-PACIFIC",
        "headline": "ASIA MARKETS ROAR BACK ON AI REBOUND; TAIWAN LEAPS +9.1%, KOSPI +7.5%",
        "body": "Asian equities surged Tuesday following Wall Street's tech rebound; MSCI Asia-Pacific ex-Japan rose +4.6% in its biggest single-day gain since July. Fed December rate hike odds firmed. (Context: Wall Street surged Monday with Nvidia +31.5% after Jensen Huang's reinstatement).",
        "src": "Reuters",
        "lat": 25.0,
        "lon": 121.5,
        "svg": svg_markets(),
    },
    {
        "num": "2",
        "kicker": "SECURITY · EAST ASIA",
        "headline": "KOREA SCRAMBLES JETS AFTER SUSPECTED NORTH KOREAN AIRSPACE BREACH",
        "body": "South Korean fighters scrambled Tuesday as a suspected North Korean aircraft approached Ulleung Island; residents were ordered to shelters. Separately, jets scrambled as Russian warplanes entered Korea's air defense identification zone.",
        "src": "TOI / Japan Times",
        "lat": 37.5,
        "lon": 130.9,
        "svg": svg_korea(),
    },
    {
        "num": "3",
        "kicker": "MIDDLE EAST · GAZA STRIP",
        "headline": "ISRAELI AIRSTRIKE KILLS AT LEAST 3 IN KHAN YOUNIS; TROOPS CONTROL 2/3 OF GAZA",
        "body": "An Israeli airstrike killed at least three Palestinians near a police outpost in Khan Younis on Tuesday; Israeli ground forces consolidated operational control over approximately two-thirds of the Gaza Strip.",
        "src": "Reuters",
        "lat": 31.3,
        "lon": 34.3,
        "svg": svg_gaza(),
    },
]

FEATURE_CARDS = [
    (
        "4",
        "EUROPE · UKRAINE",
        make_feat_svg(
            "KYIV REGION STRIKES",
            "#1D4ED8",
            "Emergency Toll Updating",
            """<circle cx="96" cy="34" r="20" fill="#DBEAFE"/>
            <path d="M80 44 L112 24" stroke="#1D4ED8" stroke-width="2.5"/>
            <circle cx="112" cy="24" r="4" fill="#DC2626"/>""",
            "#EFF6FF",
        ),
        "RUSSIAN STRIKES HIT KYIV REGION; OFFICIALS REPORT TOLL UPDATING",
        "Emergency services confirm fresh missile strikes on Kyiv region Tuesday with search operations ongoing; casualty figures updating from weekend barrages.",
        "State Emergency Service / Reuters",
        50.45,
        30.52,
        "#1D4ED8",
    ),
    (
        "5",
        "DIPLOMACY · NATO",
        make_feat_svg(
            "NATO · SPACE DEFENSE",
            "#1E40AF",
            "Mark Rutte Talks Wed",
            """<circle cx="96" cy="34" r="16" fill="none" stroke="#2563EB" stroke-width="1.8" stroke-dasharray="3 2"/>
            <circle cx="96" cy="34" r="5" fill="#1E3A8A"/>
            <circle cx="110" cy="26" r="3" fill="#DC2626"/>""",
            "#EFF6FF",
        ),
        "TRUMP TO MEET NATO CHIEF RUTTE AS ALLIES WARN OF RUSSIAN SPACE WEAPON",
        "Donald Trump is scheduled to meet NATO Secretary General Mark Rutte Wednesday in Florida; allies warn Russia could deploy an orbital anti-satellite nuclear device next month.",
        "Reuters / SCMP",
        50.85,
        4.35,
        "#1D4ED8",
    ),
    (
        "6",
        "POLITICS · UNITED STATES",
        make_feat_svg(
            "US HOUSE RESIGNATION",
            "#B91C1C",
            "Ethics Panel Findings",
            """<path d="M76 44 L96 22 L116 44 Z" fill="#94A3B8"/>
            <rect x="88" y="32" width="16" height="12" fill="#475569"/>""",
            "#FEF2F2",
        ),
        "REP. JIMMY GOMEZ RESIGNS FOLLOWING ETHICS MISCONDUCT FINDINGS",
        "California Representative Jimmy Gomez resigned his congressional seat Tuesday after a bipartisan House Ethics Committee report found substantial evidence of sexual misconduct with a staffer.",
        "TOI",
        38.9,
        -77.0,
        "#1D4ED8",
    ),
    (
        "7",
        "COURTS · UNITED STATES",
        make_feat_svg(
            "IOWA PLANT EXPLOSIVES",
            "#B45309",
            "White House Halts Blast",
            """<rect x="82" y="26" width="28" height="18" rx="2" fill="#D97706"/>
            <line x1="96" y1="20" x2="96" y2="26" stroke="#451A03" stroke-width="2"/>""",
            "#FFFBEB",
        ),
        "TRUMP HALTS IOWA EXPLOSIVES DEMOLITION PENDING COURT REVIEW",
        "The White House paused the planned detonation of degraded ordnance at Iowa's Middletown Army Ammunition Plant pending legal review; a separate order directed federal executions to be expedited.",
        "AFP",
        40.8,
        -91.2,
        "#1D4ED8",
    ),
    (
        "8",
        "TECH LAW · UNITED STATES",
        make_feat_svg(
            "STATES SUE xAI (GROK)",
            "#6D28D9",
            "AI Deepfake Litigation",
            """<circle cx="86" cy="34" r="6" fill="#7C3AED"/>
            <circle cx="106" cy="34" r="6" fill="#7C3AED"/>
            <line x1="86" y1="34" x2="106" y2="34" stroke="#4C1D95" stroke-width="2"/>""",
            "#F5F3FF",
        ),
        "US STATES SUE ELON MUSK'S X OVER AI-GENERATED SEXUALIZED IMAGES",
        "State attorneys general filed suit against xAI and X Corp, alleging failure to halt the proliferation of non-consensual sexualized deepfakes generated by the Grok chatbot.",
        "Reuters",
        37.7,
        -122.4,
        "#1D4ED8",
    ),
    (
        "9",
        "SOUTH ASIA · BANGLADESH",
        make_feat_svg(
            "BANGLADESH POLITICS",
            "#047857",
            "Hasina Dhaka Plan Dec 16",
            """<circle cx="96" cy="34" r="14" fill="#059669"/>
            <circle cx="96" cy="34" r="6" fill="#DC2626"/>""",
            "#ECFDF5",
        ),
        "OUSTED BANGLADESH PM SHEIKH HASINA PLANS RETURN HOME DEC 16",
        "A spokesperson for exiled former Prime Minister Sheikh Hasina stated she plans to return to Dhaka from India on December 16, despite facing active domestic arrest warrants.",
        "Reuters",
        23.8,
        90.4,
        "#1D4ED8",
    ),
    (
        "10",
        "AFRICA · SUDAN",
        make_feat_svg(
            "KHARTOUM DRONE STRIKE",
            "#DC2626",
            "4 Dead · UN Facility Hit",
            """<circle cx="96" cy="34" r="16" fill="none" stroke="#DC2626" stroke-width="1.8"/>
            <line x1="96" y1="16" x2="96" y2="52" stroke="#DC2626" stroke-width="1.2"/>
            <line x1="78" y1="34" x2="114" y2="34" stroke="#DC2626" stroke-width="1.2"/>""",
            "#FEF2F2",
        ),
        "DRONES HIT HOMES AND UN COMPOUND IN KHARTOUM; AT LEAST 4 KILLED",
        "Aerial drone strikes struck residential quarters and a United Nations facility in Khartoum on Tuesday, killing at least four civilians and wounding nine others.",
        "AFP",
        15.5,
        32.5,
        "#1D4ED8",
    ),
    (
        "11",
        "COMMODITIES · GLOBAL",
        make_feat_svg(
            "DOLLAR 20M HIGH · GOLD",
            "#0F766E",
            "Gold Rebound $3,657/oz",
            """<rect x="78" y="28" width="36" height="14" rx="2" fill="#F59E0B" stroke="#B45309" stroke-width="1"/>
            <text x="96" y="38" text-anchor="middle" fill="#78350F" font-family="'Consolas', monospace" font-size="8" font-weight="800">$3,657</text>""",
            "#F0FDFA",
        ),
        "DOLLAR HOVERS NEAR 20-MONTH HIGH AS GOLD BOUNCES TO $3,657/OZ",
        "The US dollar hovered near a 20-month peak on firming Fed rate expectations; spot gold rebounded from 14-month lows to $3,657/oz while Brent crude held at $89.50/bbl.",
        "Reuters",
        40.7,
        -74.0,
        "#1D4ED8",
    ),
    (
        "12",
        "SPORT · GLOBAL",
        make_feat_svg(
            "2031 WOMEN'S WORLD CUP",
            "#047857",
            "US / MEX / CR / JAM Host",
            """<circle cx="96" cy="34" r="14" fill="#FFF" stroke="#1E293B" stroke-width="1.5"/>
            <path d="M96 26 L102 31 L100 38 L92 38 L90 31 Z" fill="#1E293B"/>""",
            "#F0FDF4",
        ),
        "US, MEXICO, COSTA RICA & JAMAICA TO CO-HOST 2031 WOMEN'S WORLD CUP",
        "FIFA confirmed a joint North and Central American bid will host the 2031 Women's World Cup, with the UK awarded the 2035 tournament (announced late Mon 21:36 UTC / Tue Asia-Pacific; FIFA).",
        "FIFA / Reuters",
        25.8,
        -80.2,
        "#1D4ED8",
    ),
    (
        "13",
        "ARTIFICIAL INTELLIGENCE",
        make_feat_svg(
            "ANTHROPIC CLAUDE SHIP",
            "#4338CA",
            "Automated Code Review",
            """<rect x="76" y="24" width="40" height="20" rx="3" fill="#1E1B4B"/>
            <text x="82" y="37" fill="#38BDF8" font-family="'Consolas', monospace" font-size="9" font-weight="800">&gt;_</text>""",
            "#EEF2FF",
        ),
        "ANTHROPIC LAUNCHES 'CLAUDE SHIP' AI TOOL FOR CODE REVIEW AUTOMATION",
        "Anthropic released Claude Ship, an automated developer agent designed to inspect software pull requests, detect vulnerabilities, and enforce testing standards.",
        "TechCrunch",
        37.8,
        -122.4,
        "#1D4ED8",
    ),
]

BRIEFS: list[tuple[str, str, str, str]] = [
    ("14", "London", "Court sentences GTA VI hacker Kurtaj to 7 years, frees him on time served; concert evacuated.", "SCMP"),
    ("15", "Pakistan", "Magnitude 4.1 earthquake strikes northern Pakistan; NCS reports no immediate casualties.", "NCS"),
    ("16", "Zanzibar", "Fire ravages six beach hotels; emergency teams evacuate 180 foreign tourists.", "AFP"),
    ("17", "Louisiana", "Amtrak train carrying 95 passengers derails after collision with semitruck; 5 injured.", "AP"),
    ("18", "Washington", "Honda recalls 810,592 vehicles nationwide due to Takata airbag inflator rupture hazard.", "NHTSA"),
    ("19", "Indonesia", "Rescuers recover additional victims from candy factory fire; 34 workers unaccounted for.", "Reuters"),
    ("20", "Beijing", "State security court sentences senior official to death for leaking classified state secrets.", "AP"),
    ("21", "Istanbul", "Thousands march in Istanbul and Ankara protesting government shutdown of independent media.", "AFP"),
    ("22", "Paris", "Macron floats constitutional amendments to enforce deficit caps; 3 detained over rail derailment.", "Le Monde"),
    ("23", "Berlin", "Coordinated bomb threat emails target schools across three states; police assess hoax risk.", "DPA"),
    ("24", "London", "NHS launches world's largest clinical trial evaluating AI-assisted breast cancer screening.", "Guardian"),
    ("25", "Warsaw", "Intelligence agencies report thwarting two Russian assassination attempts on Ukrainian rapper.", "PAP"),
    ("26", "Havana", "WHO Director-General arrives in Havana as island's public healthcare infrastructure nears collapse.", "AP"),
    ("27", "Rome", "WFP warns escalating global conflicts threaten emergency food rations for 7.3 million civilians.", "UN News"),
    ("28", "Jakarta", "Former national police inspector general indicted on treason charges over coup plot allegation.", "Antara"),
    ("29", "New Delhi", "Nepalese Prime Minister opens bilateral summit focusing on hydroelectric power trade.", "PTI"),
    ("30", "Pyongyang", "Pyongyang threatens closure of Swiss diplomatic representation in retaliatory measure.", "AFP"),
    ("31", "Tokyo", "Manufacturing sector expands into positive territory; flash PMI reaches 53.7 in November.", "S&P Global"),
    ("32", "Seoul", "Bank of Korea widely anticipated to raise benchmark interest rate to 3.25% at Thursday meeting.", "Reuters Poll"),
    ("33", "Honiara", "Ex-PM Sogavare cautions government against abandoning security cooperation with Beijing.", "RNZ"),
    ("34", "Sydney", "New South Wales health registry reports record number of voluntary assisted deaths in annual data.", "SMH"),
    ("35", "Namibia", "CTBTO concludes 7-week, 60-nation on-site nuclear inspection exercise in Namibian desert.", "CTBTO"),
]


def geo_xy(lat: float, lon: float) -> tuple[float, float]:
    x = round((lon + 180.0) / 360.0 * 282.0, 1)
    y = round((80.0 - lat) / 140.0 * 144.0, 1)
    return x, y


def build_world_map_svg() -> str:
    # N1 — Continent vectors sourced from own 20 Nov entry
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
    # Features 4-13 pins
    for num, _, _, _, _, _, lat, lon, col in FEATURE_CARDS:
        cx, cy = geo_xy(lat, lon)
        if num == "13":
            # Offset pin 13 to avoid overlap with pin 8 (both SF)
            cx, cy = cx + 4.5, cy - 3.5
        pins.append(
            f'<circle cx="{cx}" cy="{cy}" r="5.3" fill="{col}" stroke="#FFF" stroke-width="0.9"/>'
            f'<text x="{cx}" y="{cy + 2.1}" text-anchor="middle" fill="#FFF" font-family="\'Inter\', sans-serif" font-size="6.1" font-weight="800">{num}</text>'
        )

    # Leads 1-3 pins
    for c in LEAD_CARDS:
        cx, cy = geo_xy(c["lat"], c["lon"])
        pins.append(
            f'<circle cx="{cx}" cy="{cy}" r="6.4" fill="#B91C1C" stroke="#FFF" stroke-width="1.0"/>'
            f'<text x="{cx}" y="{cy + 2.4}" text-anchor="middle" fill="#FFF" font-family="\'Inter\', sans-serif" font-size="7.2" font-weight="800">{c["num"]}</text>'
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
        f'<div class="reg-seg" style="width:{pct}%;background:{color}">{escape(name)} {cnt}</div>'
        for name, cnt, color, pct in REGIONS
    )

    leads_html = "\n".join(
        f"""      <article class="lead-card">
        <div class="lead-art">{c["svg"]}</div>
        <div class="kicker-line"><span class="npill np-lead">{c["num"]}</span><span class="kicker-txt">{escape(c["kicker"])}</span></div>
        <h2 class="lead-hl">{escape(c["headline"])}</h2>
        <p class="lead-body">{escape(c["body"])} <span class="src">({escape(c["src"])})</span></p>
      </article>"""
        for c in LEAD_CARDS
    )

    feats_html = "\n".join(
        f"""      <article class="feat-card">
        <div class="feat-art">{svg}</div>
        <div class="kicker-sm"><span class="npill np-feat">{num}</span><span class="kicker-txt">{escape(kicker)}</span></div>
        <h3 class="feat-hl">{escape(hl)}</h3>
        <p class="feat-body">{escape(body)} <span class="src">({escape(src)})</span></p>
      </article>"""
        for num, kicker, svg, hl, body, src, _, _, _ in FEATURE_CARDS
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
<title>Tuesday 24 November 2026</title>
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
    padding: 9px 17px 7px 17px;
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .top-bar {{
    display: flex; justify-content: space-between;
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em;
    color: #B91C1C; padding-bottom: 2px; border-bottom: 2px solid #111827;
  }}
  .top-right {{ color: #111827; }}
  .masthead {{ text-align: center; border-bottom: 1.5px solid #111827; padding: 1px 0 3px 0; }}
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
    padding: 4px 0; border-bottom: 1px solid #C8BFA8;
  }}
  .kpi-item {{ border-left: 2px solid #94A3B8; padding-left: 7px; }}
  .kpi-item:first-child {{ border-left: none; padding-left: 0; }}
  .kpi-val {{ font-family: 'Georgia', 'Times New Roman', serif; font-size: 19px; font-weight: 900; line-height: 1.02; }}
  .kpi-lbl {{ font-size: 8.2px; line-height: 1.13; color: #334155; font-weight: 600; margin-top: 1px; }}
  .reg-bar {{ display: flex; height: 15px; margin-top: 3px; border-radius: 2px; overflow: hidden; }}
  .reg-seg {{
    color: #FFF; font-size: 8.3px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; letter-spacing: 0.03em;
  }}
  .lead-grid {{
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin-top: 4px; padding-bottom: 5px; border-bottom: 1.5px solid #111827;
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
    font-size: 8.7px; line-height: 1.17; color: #1E293B;
    max-height: 48px; overflow: hidden;
  }}
  .src {{ color: #64748B; font-style: italic; font-weight: 600; }}
  .feat-grid {{
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
    margin-top: 4px; padding-bottom: 5px; border-bottom: 1.5px solid #111827;
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
    font-size: 7.0px; line-height: 1.12; color: #334155;
    max-height: 32px; overflow: hidden;
  }}
  .bottom-band {{
    display: grid; grid-template-columns: 282px 1fr; gap: 12px; margin-top: 3px;
  }}
  .sec-h {{
    font-size: 8.8px; font-weight: 900; letter-spacing: 0.05em; color: #0F172A;
    margin-bottom: 3px; display: flex; justify-content: space-between;
  }}
  .map-wrap {{ width: 282px; height: 144px; overflow: hidden; border-radius: 2px; }}
  .map-cap {{ font-size: 7.3px; color: #475569; margin-top: 2px; font-weight: 600; }}
  .bcols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
  .brow {{ font-size: 8.8px; line-height: 1.24; color: #1E293B; margin-bottom: 1.7px; }}
  .bnum {{
    display: inline-block; min-width: 14px; text-align: center;
    background: #1E3A8A; color: #FFF; font-size: 7.2px; font-weight: 800;
    border-radius: 2px; margin-right: 3px; padding: 0 2px;
  }}
  .bsrc {{ color: #64748B; font-size: 7.6px; }}
  .date-check {{
    border: 1.4px solid #B91C1C; background: #FEF2F2;
    padding: 3.5px 7px; font-size: 7.9px; line-height: 1.22; color: #7F1D1D;
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
        <span class="top-right">35 SOURCED STORIES · 6 CONTINENTS · EVERY ONE DATED TUESDAY 24 NOVEMBER 2026</span>
      </div>
      <div class="masthead">
        <h1>Tuesday 24 November 2026</h1>
        <p class="deck">AI stocks surge · Korea airspace scramble · Gaza strike · NATO space warning · Global brief</p>
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
        <div class="sec-h"><span>ALSO ON TUESDAY 24 NOVEMBER — 22 MORE STORIES</span><span style="color:#64748B;">WORLD BRIEFS 14–35</span></div>
        <div class="bcols">
          <div>{render_bcol(col1)}</div>
          <div>{render_bcol(col2)}</div>
        </div>
      </div>
    </section>

    <footer>
      <div class="date-check">
        <b>DATE DISCIPLINE (EXCLUDED FROM STORIES):</b> Events occurring prior to Tuesday 24 Nov 2026 are excluded from numbered stories: COP31 climate conference collapse (Sun 22 Nov), Nvidia CEO reinstatement announcement (Mon 23 Nov; Tuesday market response shown in #1), Ukraine strike on Russian warship off Libya (Mon 23 Nov), and Dymer apartment strike toll of 11 (Sun 22 Nov).
      </div>
      <div class="colophon">
        <span>Every story happened or was first reported on Tuesday 24 November 2026. Officials' counts &amp; claims attributed.</span>
        <span>Sources: Reuters · AP · AFP · TOI · SCMP · TechCrunch · S&amp;P Global · NHTSA · NCS · Original drawings</span>
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
        # M4 — Font readiness sync
        page.goto(HTML_PATH.as_uri(), wait_until="networkidle")
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(300)
        page.screenshot(path=str(PNG_PATH), full_page=False)
        browser.close()

    img = Image.open(PNG_PATH).convert("RGB")
    assert img.size == (1024, 1024), f"Expected 1024x1024, got {img.size}"
    img.save(PNG_PATH, format="PNG", optimize=True)
    img.resize((300, 300), Image.Resampling.LANCZOS).save(PREVIEW_300_PATH, format="PNG", optimize=True)

    # M5 — Hard size assert
    png_size = PNG_PATH.stat().st_size
    assert png_size < 1_048_576, f"PNG exceeds 1 MiB cap: {png_size} bytes"
    print(f"Rendered {PNG_PATH} ({png_size} bytes)")


if __name__ == "__main__":
    render_broadsheet()
