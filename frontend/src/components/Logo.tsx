

const ProdexaLogo = ({ size = 56, className = "", showWordmark = true }) => {
  return (
    <div className={`flex flex-col items-center ${className}`} style = {{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="PRODEXA"
      >
        
        <path
          d="M20 12 H58 C78 12 88 24 88 40
             C88 54 79 63 65 67 L51 71 H37 L20 85 Z
             M37 27 V55 H58 C68 55 74 49 74 40
             C74 32 68 27 58 27 Z"
          fill="#FF6B00"
          fillRule="evenodd"
        />

        {/* Factory */}
        <path
          d="M25 57 L38 47 V53 L49 45 V57 H58 V68 H25 Z"
          fill="#FF6B00"
        />

        {/* Factory Windows */}
        <g fill="#FFFFFF">
          <rect x="30" y="59" width="4" height="4" />
          <rect x="38" y="59" width="4" height="4" />
          <rect x="46" y="59" width="4" height="4" />
        </g>

        {/* Product Box */}
        <path
          d="M59 61 L72 54 L85 61 V76 L72 84 L59 76 Z"
          fill="#FFFFFF"
        />
        <path
          d="M59 61 L72 68 L85 61 M72 68 V84"
          fill="none"
          stroke="#FF6B00"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      
      {showWordmark && (
        <p className="mt-2 text-2xl font-extrabold tracking-widest text-[#FF6B00]">
          PRODEXA
        </p>
      )}

    </div>
  );
};

export default ProdexaLogo;
