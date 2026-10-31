import { useId } from "react";

// Redibujo de public/panenka.png. Las coordenadas salen de calcar el PNG, por eso
// no son redondas. El viewBox centra el balón para poder ponerlo en el punto de saque.
type Mood = "harto" | "dormido" | "contento";

const TINTA = "#111111";
const PANEL = "#262626";
const SOMBRA = "#dcdcdc";
const OJERA = "#767676";
const HUMO = "#7f7f7f";
const FILTRO = "#e3a03f";
const ASCUA = "#e9823a";

const PELO = [
    "M32.5 63C35 55 40 52 47 51C49 51 52 52 54.5 54",
    "M40.5 36C48 33 60 31 66 36C68 37.5 69 39.5 70 41.5",
    "M63.5 20.5C59 30 53 36 47 40.5",
    "M57.5 30C55.5 38 58 46 63.5 52",
    "M56 31C64 25 73 28 79.5 37",
    "M81 17C87 20 89.5 26 86.5 31C85 34 85 37 86.5 39",
    "M82 21C94 18 101 28 103.5 35C104.5 38 104.5 42 103.5 47.5",
    "M106.5 12.5C97 15 94 25 92.5 32L93 37.5",
    "M101 34C96 39 92 45 91 52.5",
    "M107.5 24C104 25 102 28 101.5 31",
    "M113 26C117 29 119 36 119 47",
    "M125.5 21C131 27 132 36 128 41L123.5 43.5",
    "M128 47C132 40 140 33.5 149 35",
    "M133 50.5C137 48 139 44 143 43C147 42 150 46 154 46C156.5 45.5 158 43.5 159.5 41",
    "M145 47C152 48 158 54 162 60",
];

const PELO_CORTO = [
    "M30 66C33 56 39 51 48 50",
    "M38 38C48 33 58 32 67 39",
    "M63.5 20C59 30 53 36 47 42",
    "M81 18C91 21 90 29 86.5 38",
    "M107 17C97 19 94 26 92.5 36",
    "M125.5 21C131 27 132 34 128 42",
    "M127 47C132 40 140 33.5 150 35",
    "M145 47C153 48 159 54 164 62",
];

const COSTURAS = [
    "M83 42C78 47 73 54 69.5 61.5",
    "M110 42C115 47 119.5 54 122.5 61",
    "M39 71.5L47.5 74.5",
    "M145.5 74.5L153 71",
    "M49.5 98C45 104 41.5 111 39.5 118.5",
    "M144 100C147 106 150.5 113 152.5 119.5",
    "M52 143C58 144.5 65 145 73.5 144.5",
    "M116 146C124 146.5 132 146 139.5 143.5",
    "M90 158L86 168",
    "M73 108L82.5 122.5",
];

const OJO_IZQ = "M66.5 90.5C75 89 90 87.5 102 86C101.5 94 96 101 87 101.5C80 101.5 75 97 72 90Z";
const OJO_DER = "M111 86C120 88.5 132 89 143 88.5C141 95 135 100.5 125.5 100.5C117 100.5 112 95 111 86Z";

function Humo() {
    return (
        <path
            className="panenka-humo"
            d="M141 109C133 112.5 132.5 118 136 122.5C139 126 140 128.5 137 131.5C141.5 128.5 142 125 139.5 121C136.5 116.5 136 112.5 141 109Z"
            fill={HUMO}
        />
    );
}

function Cigarro({ caido = false }: { caido?: boolean }) {
    return (
        <g transform={caido ? "rotate(11 118 124)" : undefined}>
            <path d="M121.7 125.2L137.1 137.3L133.7 141.6L118.5 129.4Z" fill="#fff" stroke={TINTA} strokeWidth={1.3} strokeLinejoin="round" />
            <ellipse cx={135.4} cy={139.5} rx={1.9} ry={2.8} transform="rotate(38 135.4 139.5)" fill={ASCUA} stroke={TINTA} strokeWidth={1} />
            <path d="M116.2 121.4L121.7 125.2L118.5 129.4L113 124.4Z" fill={FILTRO} stroke={TINTA} strokeWidth={1} strokeLinejoin="round" />
        </g>
    );
}

function Ojeras() {
    return (
        <g fill={OJERA}>
            <path d="M66 86C66 100 76 110 87 110C98 110 104 98 103.5 85Z" />
            <path d="M110.5 84C110 98 118 108 128 108C138 108 146 98 142 85Z" />
        </g>
    );
}

function Ojos({ vivo }: { vivo: boolean }) {
    return (
        <>
            <Ojeras />
            <path d={OJO_IZQ} fill="#fff" />
            <path d={OJO_DER} fill="#fff" />
            <g fill={TINTA}>
                <path d="M81.5 88.2A5.9 5.9 0 1 0 93.2 87Z" />
                <path d="M121 88.6A5.9 5.9 0 1 0 132.8 88.8Z" />
            </g>
            {vivo && (
                <g className="panenka-parpado" fill="#fff" opacity={0}>
                    <path d={OJO_IZQ} />
                    <path d={OJO_DER} />
                </g>
            )}
            <g fill="none" stroke={TINTA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M66.5 90.5C75 89 90 87.5 102 86C101.5 94 96 101 87 101.5C80 101.5 75 97 72 90" />
                <path d="M111 86C120 88.5 132 89 143 88.5" />
                <path d="M111 86C112 95 117 100.5 125.5 100.5C133 100.5 137.5 96 139.5 90" />
                <path d="M82.5 109C90 108.5 98 104 99.5 96" />
                <path d="M114 98C116 104 122 107.5 129.5 107.5" />
            </g>
        </>
    );
}

function CaraHarto({ vivo }: { vivo: boolean }) {
    return (
        <>
            <Ojos vivo={vivo} />
            <g fill="none" stroke={TINTA} strokeLinecap="round" strokeLinejoin="round">
                <g strokeWidth={2.3}>
                    <path d="M67.5 83.5C80 84.5 92 84 97 81.5C101 79.5 103.5 78 103.5 75" />
                    <path d="M110 75C110 79 113 81.5 118 82.5C125 84.5 133 84.5 141.5 82.5" />
                </g>
                <path d="M85 128.5C96 123.5 110 119.5 122 120.5C124.5 120.8 127 120.5 128.5 119" strokeWidth={2.4} />
                <path d="M83.5 125Q82 129 85.5 132.5" strokeWidth={2} />
                <path d="M100.5 131.5C104 129 109 129 114 130.5" strokeWidth={1.8} />
            </g>
            <path d="M125.8 114.5C127 117 129.5 118.5 130 121C128.5 122.5 127 121.8 125 121.5C127 120 127 117.5 125.8 114.5Z" fill={TINTA} />
            <Cigarro />
        </>
    );
}

function CaraDormido() {
    return (
        <>
            <Ojeras />
            <path d="M66 83H103.5L102 86C101.5 94 96 101 87 101.5C80 101.5 75 97 72 90L66 90Z" fill="#fff" />
            <path d="M110.5 83H144L143 88.5C141 95 135 100.5 125.5 100.5C117 100.5 112 95 111 86Z" fill="#fff" />
            <g fill="none" stroke={TINTA} strokeLinecap="round" strokeLinejoin="round">
                <g strokeWidth={2.3}>
                    <path d="M67.5 84.5C80 85.5 92 85 97 82.5C101 80.5 103.5 79 103.5 76" />
                    <path d="M110 76C110 80 113 82.5 118 83.5C125 85.5 133 85.5 141.5 83.5" />
                </g>
                <g strokeWidth={2.8}>
                    <path d="M70 92C75 99 81 101.5 87 101.5C95 101 100.5 96 102 90" />
                    <path d="M111 90C113 96 118 100.5 125.5 100.5C132 100.5 137.5 97 141 91" />
                </g>
                <g strokeWidth={2.2}>
                    <path d="M82.5 109C90 108.5 98 104 99.5 97" />
                    <path d="M114 99C116 104 122 107.5 129.5 107.5" />
                </g>
                <path d="M85 126C94 129.5 108 128.5 121 122.5" strokeWidth={2.4} />
                <path d="M100.5 134.5C104 132.5 109 132.5 113 134" strokeWidth={1.8} />
            </g>
            <Cigarro caido />
        </>
    );
}

// Contento a su manera: los mismos párpados, una ceja arriba y media sonrisa torcida
function CaraContento({ vivo }: { vivo: boolean }) {
    return (
        <>
            <Ojos vivo={vivo} />
            <g fill="none" stroke={TINTA} strokeLinecap="round" strokeLinejoin="round">
                <g strokeWidth={2.3}>
                    <path d="M67.5 83.5C80 84.5 92 84 97 81.5C101 79.5 103.5 78 103.5 75" />
                    <path d="M111 76C118 73 131 72.5 141 78" />
                </g>
                <path d="M85 121.5C95 129.5 112 128 127 116.5" strokeWidth={2.4} />
                <path d="M83 118Q81.5 121.5 85 124" strokeWidth={2} />
                <path d="M127 116.5Q130 117 131 114.5" strokeWidth={2} />
                <path d="M100.5 133.5C104 131.5 109 131 113 132" strokeWidth={1.8} />
            </g>
            <Cigarro />
        </>
    );
}

// Hasta 72px se quitan mechones y engordan las líneas finas
function Completo({ mood, vivo, clip, medio }: { mood: Mood; vivo: boolean; clip: string; medio: boolean }) {
    const pelo = (medio ? PELO.filter((_, i) => i % 3 !== 1) : PELO).map((d) => <path key={d} d={d} />);
    const trazo = medio ? 2.8 : 1.9;
    return (
        <>
            <clipPath id={clip}>
                <ellipse cx={96.5} cy={101} rx={67.4} ry={68.9} />
            </clipPath>
            <g fill="none" stroke="currentColor" strokeWidth={trazo} strokeLinecap="round">{pelo}</g>
            <ellipse cx={96.5} cy={101} rx={70} ry={71.5} fill={TINTA} stroke="currentColor" strokeWidth={2.4} />
            <g clipPath={`url(#${clip})`}>
                <rect x={26} y={29} width={141} height={144} fill={SOMBRA} />
                <ellipse cx={96.5} cy={94} rx={60} ry={65} fill="#fff" />
                <g fill={PANEL}>
                    <path d="M76 30L83.5 42.5C92 41 101 41 110 42.5L119 30Z" />
                    <path d="M69 61.5L79.5 71.7C74 73 70 77 68 82L67.5 100L49.5 97.5L46.7 76Z" />
                    <path d="M122.5 61L113 72C120 69 130 70 136 75C140 79 142 84 143 88L141 100L145 99L145.5 75.5Z" />
                    <path d="M78 132C82 140 92 141 100 139C104 137 108 136 113 136L116 146L90 158.5L73 144Z" />
                </g>
                <g fill={TINTA}>
                    <path d="M25 113L39 118.5L51.5 143L50 147L64 175L20 175Z" />
                    <path d="M170 113L152.5 119.5L139.5 143.5L140.5 148L127 175L172 175Z" />
                </g>
                <g fill="none" stroke={TINTA} strokeWidth={medio ? 2.3 : 1.7} strokeLinecap="round">
                    {COSTURAS.map((d) => <path key={d} d={d} />)}
                </g>
                <g fill="none" stroke={TINTA} strokeWidth={trazo} strokeLinecap="round">{pelo}</g>
                {mood === "harto" && <CaraHarto vivo={vivo} />}
                {mood === "dormido" && <CaraDormido />}
                {mood === "contento" && <CaraContento vivo={vivo} />}
                <Humo />
            </g>
        </>
    );
}

// A 24-40px se empasta: mismo dibujo, con menos pelo, sin costuras y con todo más gordo.
function Pequeno({ mood, vivo, clip }: { mood: Mood; vivo: boolean; clip: string }) {
    return (
        <>
            <clipPath id={clip}>
                <ellipse cx={96.5} cy={101} rx={65.5} ry={67} />
            </clipPath>
            <g fill="none" stroke="currentColor" strokeWidth={4.8} strokeLinecap="round">
                {PELO_CORTO.map((d) => <path key={d} d={d} />)}
            </g>
            <ellipse cx={96.5} cy={101} rx={71} ry={72.5} fill={TINTA} stroke="currentColor" strokeWidth={4.4} />
            <g clipPath={`url(#${clip})`}>
                <rect x={26} y={29} width={141} height={144} fill="#fff" />
                <g fill={PANEL}>
                    <path d="M76 30L83.5 42.5C92 41 101 41 110 42.5L119 30Z" />
                    <path d="M69 61.5L79.5 71.7C74 73 70 77 68 82L67.5 100L49.5 97.5L46.7 76Z" />
                    <path d="M122.5 61L113 72C120 69 130 70 136 75C140 79 142 84 143 88L141 100L145 99L145.5 75.5Z" />
                    <path d="M78 134C82 142 92 143 100 141C104 139 108 138 113 138L116 148L90 160.5L73 146Z" />
                </g>
                <g fill={TINTA}>
                    <path d="M25 113L39 118.5L51.5 143L50 147L64 175L20 175Z" />
                    <path d="M170 113L152.5 119.5L139.5 143.5L140.5 148L127 175L172 175Z" />
                </g>
                <Ojeras />
                {mood === "dormido" ? (
                    <g fill="none" stroke={TINTA} strokeWidth={5.4} strokeLinecap="round">
                        <path d="M68 86H104C103 97 96 103 86 103C76 103 69 96 68 86Z" fill="#fff" stroke="none" />
                        <path d="M112 86H144C143 96 136 102 126 102C117 102 112 96 112 86Z" fill="#fff" stroke="none" />
                        <path d="M71 92C78 102 94 103 102 89" />
                        <path d="M112 89C118 102 134 102 141 91" />
                    </g>
                ) : (
                    <>
                        <path d={OJO_IZQ} fill="#fff" />
                        <path d={OJO_DER} fill="#fff" />
                        <g fill={TINTA}>
                            <path d="M78.5 88.2A8.5 8.5 0 1 0 95.5 87Z" />
                            <path d="M118 88.6A8.5 8.5 0 1 0 135 88.8Z" />
                        </g>
                        {vivo && (
                            <g className="panenka-parpado" fill="#fff" opacity={0}>
                                <path d={OJO_IZQ} />
                                <path d={OJO_DER} />
                            </g>
                        )}
                        <g fill="none" stroke={TINTA} strokeWidth={5.2} strokeLinecap="round">
                            <path d="M65 90.5L103 85.5" />
                            <path d="M110 85.5L145 88.5" />
                        </g>
                    </>
                )}
                <path
                    d={mood === "contento" ? "M84 121.5C95 130 112 128 127 116.5" : "M84 129C96 123.5 110 120 124 120.5"}
                    fill="none"
                    stroke={TINTA}
                    strokeWidth={5}
                    strokeLinecap="round"
                />
                <path d="M114 122L142 144" stroke={TINTA} strokeWidth={12} />
                <path d="M124 129.5L142 143.5" stroke="#fff" strokeWidth={7} />
                <path d="M114 122L124 129.5" stroke={FILTRO} strokeWidth={7} />
            </g>
        </>
    );
}

export function Panenka({
    size = 64,
    mood = "harto",
    animated = false,
    className,
    title,
}: {
    size?: number;
    mood?: Mood;
    animated?: boolean;
    className?: string;
    title?: string;
}) {
    const clip = `panenka-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const pequeno = size <= 40;
    const clases = [animated ? "panenka-vivo" : "", className].filter(Boolean).join(" ") || undefined;

    return (
        <svg
            width={size}
            height={size}
            viewBox={pequeno ? "10.5 15 172 172" : "6.5 11 180 180"}
            className={clases}
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
            focusable="false"
        >
            {title && <title>{title}</title>}
            {pequeno ? (
                <Pequeno mood={mood} vivo={animated} clip={clip} />
            ) : (
                <Completo mood={mood} vivo={animated} clip={clip} medio={size < 72} />
            )}
        </svg>
    );
}
