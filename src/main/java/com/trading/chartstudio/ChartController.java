package com.trading.chartstudio;

import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ChartController {

    private static final List<String> PROVIDERS = List.of("DEMO", "ANGEL_ONE", "ZERODHA", "UPSTOX", "FYERS");
    private static final List<String> INTERVALS = List.of("1m", "5m", "15m", "1h", "1d");
    private final ConcurrentHashMap<String, Candle> liveCandles = new ConcurrentHashMap<>();
    private final BrokerCandleService brokerCandleService;

    public ChartController(BrokerCandleService brokerCandleService) {
        this.brokerCandleService = brokerCandleService;
    }

    private static final List<SymbolGroup> SYMBOL_GROUPS = List.of(
        new SymbolGroup("NSE Stocks", List.of(
            new SymbolInfo("NSE:RELIANCE", "RELIANCE"),
            new SymbolInfo("NSE:TCS", "TCS"),
            new SymbolInfo("NSE:HDFCBANK", "HDFC BANK"),
            new SymbolInfo("NSE:INFY", "INFOSYS"),
            new SymbolInfo("NSE:ICICIBANK", "ICICI BANK"),
            new SymbolInfo("NSE:HINDUNILVR", "HIND UNILEVER"),
            new SymbolInfo("NSE:ITC", "ITC"),
            new SymbolInfo("NSE:SBIN", "SBI"),
            new SymbolInfo("NSE:BHARTIARTL", "BHARTI AIRTEL"),
            new SymbolInfo("NSE:KOTAKBANK", "KOTAK BANK"),
            new SymbolInfo("NSE:BAJFINANCE", "BAJAJ FINANCE"),
            new SymbolInfo("NSE:LT", "L&T"),
            new SymbolInfo("NSE:WIPRO", "WIPRO"),
            new SymbolInfo("NSE:TITAN", "TITAN"),
            new SymbolInfo("NSE:ASIANPAINT", "ASIAN PAINTS"),
            new SymbolInfo("NSE:NTPC", "NTPC"),
            new SymbolInfo("NSE:AXISBANK", "AXIS BANK"),
            new SymbolInfo("NSE:MARUTI", "MARUTI SUZUKI"),
            new SymbolInfo("NSE:SUNPHARMA", "SUN PHARMA"),
            new SymbolInfo("NSE:ONGC", "ONGC"),
            new SymbolInfo("NSE:POWERGRID", "POWER GRID"),
            new SymbolInfo("NSE:ULTRACEMCO", "ULTRATECH CEMENT"),
            new SymbolInfo("NSE:BAJAJFINSV", "BAJAJ FINSERV"),
            new SymbolInfo("NSE:ADANIPORTS", "ADANI PORTS"),
            new SymbolInfo("NSE:M&M", "M&M"),
            new SymbolInfo("NSE:JSWSTEEL", "JSW STEEL"),
            new SymbolInfo("NSE:COALINDIA", "COAL INDIA"),
            new SymbolInfo("NSE:BRITANNIA", "BRITANNIA"),
            new SymbolInfo("NSE:GRASIM", "GRASIM"),
            new SymbolInfo("NSE:TATAMOTORS", "TATA MOTORS"),
            new SymbolInfo("NSE:HCLTECH", "HCL TECH"),
            new SymbolInfo("NSE:TECHM", "TECH MAHINDRA"),
            new SymbolInfo("NSE:INDUSINDBK", "INDUSIND BANK"),
            new SymbolInfo("NSE:DRREDDY", "DR REDDY'S"),
            new SymbolInfo("NSE:CIPLA", "CIPLA"),
            new SymbolInfo("NSE:HEROMOTOCO", "HERO MOTOCORP"),
            new SymbolInfo("NSE:EICHERMOT", "EICHER MOTORS"),
            new SymbolInfo("NSE:BPCL", "BPCL"),
            new SymbolInfo("NSE:TATASTEEL", "TATA STEEL"),
            new SymbolInfo("NSE:DIVISLAB", "DIVI'S LAB"),
            new SymbolInfo("NSE:TRENT", "TRENT"),
            new SymbolInfo("NSE:BEL", "BEL"),
            new SymbolInfo("NSE:VEDL", "VEDANTA"),
            new SymbolInfo("NSE:SBILIFE", "SBI LIFE"),
            new SymbolInfo("NSE:ICICIPRULI", "ICICI PRU LIFE"),
            new SymbolInfo("NSE:DMART", "DMART"),
            new SymbolInfo("NSE:ZOMATO", "ZOMATO"),
            new SymbolInfo("NSE:PAYTM", "PAYTM"),
            new SymbolInfo("NSE:BDL", "BDL"),
            new SymbolInfo("NSE:HAL", "HAL"),
            new SymbolInfo("NSE:IRFC", "IRFC"),
            new SymbolInfo("NSE:NHPC", "NHPC"),
            new SymbolInfo("NSE:YESBANK", "YES BANK"),
            new SymbolInfo("NSE:IOC", "IOC"),
            new SymbolInfo("NSE:GAIL", "GAIL"),
            new SymbolInfo("NSE:ADANIENT", "ADANI ENT"),
            new SymbolInfo("NSE:ADANIGREEN", "ADANI GREEN"),
            new SymbolInfo("NSE:ADANITRANS", "ADANI TRANS"),
            new SymbolInfo("NSE:ABB", "ABB"),
            new SymbolInfo("NSE:SIEMENS", "SIEMENS"),
            new SymbolInfo("NSE:TATACONSUM", "TATA CONSUMER"),
            new SymbolInfo("NSE:DABUR", "DABUR"),
            new SymbolInfo("NSE:MARICO", "MARICO"),
            new SymbolInfo("NSE:BERGEPAINT", "BERGER PAINTS"),
            new SymbolInfo("NSE:PIDILITIND", "PIDILITE"),
            new SymbolInfo("NSE:HAVELLS", "HAVELLS"),
            new SymbolInfo("NSE:VOLTAS", "VOLTAS"),
            new SymbolInfo("NSE:COLPAL", "COLGATE"),
            new SymbolInfo("NSE:SRTRANSFIN", "SHRIRAM FIN"),
            new SymbolInfo("NSE:MCDOWELL-N", "MCDOWELL'S"),
            new SymbolInfo("NSE:GODREJCP", "GODREJ CP"),
            new SymbolInfo("NSE:SHREECEM", "SHREE CEMENT"),
            new SymbolInfo("NSE:AMBUJACEM", "AMBUJA CEMENT"),
            new SymbolInfo("NSE:ICICIGI", "ICICI GI"),
            new SymbolInfo("NSE:HDFCLIFE", "HDFC LIFE"),
            new SymbolInfo("NSE:DLF", "DLF"),
            new SymbolInfo("NSE:TVSMOTOR", "TVS MOTOR"),
            new SymbolInfo("NSE:BAJAJ-AUTO", "BAJAJ AUTO"),
            new SymbolInfo("NSE:POLYCAB", "POLYCAB"),
            new SymbolInfo("NSE:TORNTPHARM", "TORNTE PHARMA"),
            new SymbolInfo("NSE:APOLLOHOSP", "APOLLO HOSP"),
            new SymbolInfo("NSE:AVENUE", "AVENUE SUPER"),
            new SymbolInfo("NSE:NAUKRI", "INFO EDGE"),
            new SymbolInfo("NSE:PAGEIND", "PAGE IND"),
            new SymbolInfo("NSE:JUBLFOOD", "JUBILANT FOOD"),
            new SymbolInfo("NSE:TIINDIA", "TI INDIA"),
            new SymbolInfo("NSE:COROMANDEL", "COROMANDEL"),
            new SymbolInfo("NSE:MRF", "MRF"),
            new SymbolInfo("NSE:BOSCHLTD", "BOSCH"),
            new SymbolInfo("NSE:PATANJALI", "PATANJALI"),
            new SymbolInfo("NSE:IDEA", "VODAFONE IDEA"),
            new SymbolInfo("NSE:PFC", "PFC"),
            new SymbolInfo("NSE:RECLTD", "REC"),
            new SymbolInfo("NSE:INDUSTOWER", "INDUS TOWERS"),
            new SymbolInfo("NSE:BANDHANBNK", "BANDHAN BANK"),
            new SymbolInfo("NSE:BANKBARODA", "BANK OF BARODA"),
            new SymbolInfo("NSE:CANBK", "CANARA BANK"),
            new SymbolInfo("NSE:PNB", "PNB"),
            new SymbolInfo("NSE:UNIONBANK", "UNION BANK"),
            new SymbolInfo("NSE:FEDERALBNK", "FEDERAL BANK"),
            new SymbolInfo("NSE:IDFCFIRSTB", "IDFC FIRST BANK"),
            new SymbolInfo("NSE:RBLBANK", "RBL BANK"),
            new SymbolInfo("NSE:IDBI", "IDBI BANK"),
            new SymbolInfo("NSE:SOUTHBANK", "SOUTH INDIAN BANK"),
            new SymbolInfo("NSE:AUBANK", "AU SMALL FIN BANK"),
            new SymbolInfo("NSE:EQUITASBNK", "EQUITAS BANK"),
            new SymbolInfo("NSE:INDIANB", "INDIAN BANK"),
            new SymbolInfo("NSE:BANKINDIA", "BANK OF INDIA"),
            new SymbolInfo("NSE:KTKBANK", "KARNATAKA BANK"),
            new SymbolInfo("NSE:DCBBANK", "DCB BANK"),
            new SymbolInfo("NSE:CSBBANK", "CSB BANK"),
            new SymbolInfo("NSE:JSFB", "JANA SFB"),
            new SymbolInfo("NSE:UTKARSHBNK", "UTKARSH SFB"),
            new SymbolInfo("NSE:FIVESTAR", "FIVE STAR FIN"),
            new SymbolInfo("NSE:CHOLAFIN", "CHOLAMANDALAM"),
            new SymbolInfo("NSE:MUTHOOTFIN", "MUTHOOT FINANCE"),
            new SymbolInfo("NSE:LICHSGFIN", "LIC HOUSING FIN"),
            new SymbolInfo("NSE:HDFCAMC", "HDFC AMC"),
            new SymbolInfo("NSE:NAM-INDIA", "NIPPON AMC"),
            new SymbolInfo("NSE:MOTILALOFS", "MOTILAL OSWAL"),
            new SymbolInfo("NSE:ANGELONE", "ANGEL ONE"),
            new SymbolInfo("NSE:ICICISEC", "ICICI SEC"),
            new SymbolInfo("NSE:IIFL", "IIFL FINANCE"),
            new SymbolInfo("NSE:MANAPPURAM", "MANAPPURAM"),
            new SymbolInfo("NSE:POONAWALLA", "POONAWALLA FIN"),
            new SymbolInfo("NSE:MASFIN", "MAS FINANCIAL"),
            new SymbolInfo("NSE:CREDITACC", "CREDIT ACCESS"),
            new SymbolInfo("NSE:CANFINHOME", "CAN FIN HOMES"),
            new SymbolInfo("NSE:BAJAJHLDNG", "BAJAJ HOLDINGS"),
            new SymbolInfo("NSE:SBICARD", "SBI CARDS"),
            new SymbolInfo("NSE:NESTLE", "NESTLE INDIA"),
            new SymbolInfo("NSE:VBL", "VARUN BEVERAGES"),
            new SymbolInfo("NSE:GODREJAGRO", "GODREJ AGRO"),
            new SymbolInfo("NSE:RADICO", "RADICO KHAITAN"),
            new SymbolInfo("NSE:GLAXO", "GLAXOSMITHKLINE"),
            new SymbolInfo("NSE:GILLETTE", "GILLETTE INDIA"),
            new SymbolInfo("NSE:PGHL", "PROCTER & GAMBLE"),
            new SymbolInfo("NSE:EMAMILTD", "EMAMI"),
            new SymbolInfo("NSE:BAJAJCON", "BAJAJ CONSUMER"),
            new SymbolInfo("NSE:LUPIN", "LUPIN"),
            new SymbolInfo("NSE:ALKEM", "ALKEM LABS"),
            new SymbolInfo("NSE:AUROPHARMA", "AUROBINDO PHARMA"),
            new SymbolInfo("NSE:BIOCON", "BIOCON"),
            new SymbolInfo("NSE:ZYDUSLIFE", "ZYDUS LIFE"),
            new SymbolInfo("NSE:PFIZER", "PFIZER"),
            new SymbolInfo("NSE:ABBOTINDIA", "ABBOTT INDIA"),
            new SymbolInfo("NSE:GLENMARK", "GLENMARK PHARMA"),
            new SymbolInfo("NSE:NATCOPHARM", "NATCO PHARMA"),
            new SymbolInfo("NSE:LAURUSLABS", "LAURUS LABS"),
            new SymbolInfo("NSE:GRANULES", "GRANULES INDIA"),
            new SymbolInfo("NSE:JBCHEPHARM", "JB CHEMICALS"),
            new SymbolInfo("NSE:IPCALAB", "IPCA LABS"),
            new SymbolInfo("NSE:SANOFI", "SANOFI INDIA"),
            new SymbolInfo("NSE:CADILAHC", "CADILA HC"),
            new SymbolInfo("NSE:STARHEALTH", "STAR HEALTH"),
            new SymbolInfo("NSE:MEDANTA", "MEDANTA HOSPITAL"),
            new SymbolInfo("NSE:FORTIS", "FORTIS HOSPITAL"),
            new SymbolInfo("NSE:MAXHEALTH", "MAX HEALTHCARE"),
            new SymbolInfo("NSE:NH", "NARAYANA HRUDAYA"),
            new SymbolInfo("NSE:METROPOLIS", "METROPOLIS"),
            new SymbolInfo("NSE:SYMPHONY", "SYMPHONY"),
            new SymbolInfo("NSE:BAJAJELEC", "BAJAJ ELECTRICAL"),
            new SymbolInfo("NSE:CROMPTON", "CROMPTON GREAVES"),
            new SymbolInfo("NSE:KAJARIACER", "KAJARIA CERAMICS"),
            new SymbolInfo("NSE:CENTRALBK", "CENTRAL BANK"),
            new SymbolInfo("NSE:LTF", "L&T FINANCE"),
            new SymbolInfo("NSE:PNBHOUSING", "PNB HOUSING"),
            new SymbolInfo("NSE:HINDALCO", "HINDALCO"),
            new SymbolInfo("NSE:HINDZINC", "HIND ZINC"),
            new SymbolInfo("NSE:JINDALSTEL", "JINDAL STEEL"),
            new SymbolInfo("NSE:SAIL", "SAIL"),
            new SymbolInfo("NSE:NATIONALUM", "NATIONAL ALUM"),
            new SymbolInfo("NSE:NMDC", "NMDC"),
            new SymbolInfo("NSE:MOIL", "MOIL"),
            new SymbolInfo("NSE:APLAPOLLO", "APL APOLLO TUBES"),
            new SymbolInfo("NSE:RATNAMANI", "RATNAMANI METAL"),
            new SymbolInfo("NSE:WELCORP", "WELSPUN CORP"),
            new SymbolInfo("NSE:MAHSEAMLES", "MAHARASHTRA SEAML"),
            new SymbolInfo("NSE:ACC", "ACC"),
            new SymbolInfo("NSE:RAMCOCEM", "RAMCO CEMENT"),
            new SymbolInfo("NSE:JKCEMENT", "JK CEMENT"),
            new SymbolInfo("NSE:DALMIABHA", "DALMIA BHARAT"),
            new SymbolInfo("NSE:HEIDELBERG", "HEIDELBERGCEM"),
            new SymbolInfo("NSE:STARCEMENT", "STAR CEMENT"),
            new SymbolInfo("NSE:NCC", "NCC"),
            new SymbolInfo("NSE:KALPATARU", "KALPATARU POWER"),
            new SymbolInfo("NSE:IRB", "IRB INFRA"),
            new SymbolInfo("NSE:ASHOKA", "ASHOKA BUILDCON"),
            new SymbolInfo("NSE:PNCINFRA", "PNC INFRA"),
            new SymbolInfo("NSE:SADBHAV", "SADBHAV ENG"),
            new SymbolInfo("NSE:LARSEN", "L&T"),
            new SymbolInfo("NSE:TATACOMM", "TATA COMMS"),
            new SymbolInfo("NSE:ZEEL", "ZEE ENTERTAIN"),
            new SymbolInfo("NSE:PVRINOX", "PVR INOX"),
            new SymbolInfo("NSE:SUNTV", "SUN TV"),
            new SymbolInfo("NSE:NETWORK18", "NETWORK18"),
            new SymbolInfo("NSE:TV18BRDCST", "TV18 BROADCAST"),
            new SymbolInfo("NSE:NAZARA", "NAZARA TECH"),
            new SymbolInfo("NSE:ABFRL", "ABHILASH FUTURE"),
            new SymbolInfo("NSE:ADANIPOWER", "ADANI POWER"),
            new SymbolInfo("NSE:TATAPOWER", "TATA POWER"),
            new SymbolInfo("NSE:ADANITOTAL", "ADANI TOTAL GAS"),
            new SymbolInfo("NSE:ADANIWILMAR", "ADANI WILMAR"),
            new SymbolInfo("NSE:JSWENERGY", "JSW ENERGY"),
            new SymbolInfo("NSE:CESC", "CESC"),
            new SymbolInfo("NSE:TORNTPOWER", "TORNTE POWER"),
            new SymbolInfo("NSE:SUZLON", "SUZLON ENERGY"),
            new SymbolInfo("NSE:INOXWIND", "INOX WIND"),
            new SymbolInfo("NSE:SUNDARMFIN", "SUNDARAM FINANCE"),
            new SymbolInfo("NSE:TVSHEETAL", "SHEETAL"),
            new SymbolInfo("NSE:ENGINERSIN", "ENGINEERS INDIA"),
            new SymbolInfo("NSE:NBCC", "NBCC"),
            new SymbolInfo("NSE:RITES", "RITES"),
            new SymbolInfo("NSE:MISHRA", "MISHRA DHATU"),
            new SymbolInfo("NSE:GMRINFRA", "GMR INFRA"),
            new SymbolInfo("NSE:ADITYABIRL", "ADITYA BIRLA"),
            new SymbolInfo("NSE:MPHASIS", "MPHASIS"),
            new SymbolInfo("NSE:COFORGE", "COFORGE"),
            new SymbolInfo("NSE:PERSISTENT", "PERSISTENT SYS"),
            new SymbolInfo("NSE:LTIM", "LTIMINDTREE"),
            new SymbolInfo("NSE:HEXAWARE", "HEXAWARE TECH"),
            new SymbolInfo("NSE:CYIENT", "CYIENT"),
            new SymbolInfo("NSE:KPITTECH", "KPIT TECH"),
            new SymbolInfo("NSE:TATAELXSI", "TATA ELXSI"),
            new SymbolInfo("NSE:ZENSARTECH", "ZENSAR TECH"),
            new SymbolInfo("NSE:BSOFT", "BIRLA SOFT"),
            new SymbolInfo("NSE:NIITTECH", "NIIT TECH"),
            new SymbolInfo("NSE:LTI", "LTI"),
            new SymbolInfo("NSE:MINDACORP", "MINDA CORP"),
            new SymbolInfo("NSE:SONACOMS", "SONA BLW"),
            new SymbolInfo("NSE:ASHOKLEY", "ASHOK LEYLAND"),
            new SymbolInfo("NSE:ESCORTS", "ESCORTS"),
            new SymbolInfo("NSE:MOTHERSON", "SAMVARDHANA"),
            new SymbolInfo("NSE:APOLLOTYRE", "APOLLO TYRES"),
            new SymbolInfo("NSE:BALKRISIND", "BALKRISHNA IND"),
            new SymbolInfo("NSE:CEATLTD", "CEAT"),
            new SymbolInfo("NSE:EXIDEIND", "EXIDE IND"),
            new SymbolInfo("NSE:AMARAJABAT", "AMARA RAJA BAT"),
            new SymbolInfo("NSE:OIL", "OIL INDIA"),
            new SymbolInfo("NSE:GUJGAS", "GUJARAT GAS"),
            new SymbolInfo("NSE:MGL", "MGL"),
            new SymbolInfo("NSE:IGL", "INDRAPRASTHA GAS"),
            new SymbolInfo("NSE:PETRONET", "PETRONET LNG"),
            new SymbolInfo("NSE:HPCL", "HPCL"),
            new SymbolInfo("NSE:CASTROL", "CASTROL INDIA"),
            new SymbolInfo("NSE:GNFC", "GNFC"),
            new SymbolInfo("NSE:GSFC", "GSFC"),
            new SymbolInfo("NSE:CHAMBLFERT", "CHAMBAL FERT"),
            new SymbolInfo("NSE:RCF", "RCF"),
            new SymbolInfo("NSE:UPL", "UPL"),
            new SymbolInfo("NSE:PIIND", "PI INDUSTRIES"),
            new SymbolInfo("NSE:BAYERCROP", "BAYER CROPSCI"),
            new SymbolInfo("NSE:BASFINDIA", "BASF INDIA"),
            new SymbolInfo("NSE:DEEPAKNTR", "DEEPAK NITRITE"),
            new SymbolInfo("NSE:SRF", "SRF"),
            new SymbolInfo("NSE:GUJALKALI", "GUJ ALKALIES"),
            new SymbolInfo("NSE:TATACHEM", "TATA CHEMS"),
            new SymbolInfo("NSE:VINATIORGA", "VINATI ORG"),
            new SymbolInfo("NSE:AARTIIND", "AARTI IND"),
            new SymbolInfo("NSE:NAVINFLUOR", "NAVIN FLUORINE"),
            new SymbolInfo("NSE:METROBRAND", "METRO BRANDS"),
            new SymbolInfo("NSE:BATAINDIA", "BATA INDIA"),
            new SymbolInfo("NSE:RELAXO", "RELAXO FOOTWEARS"),
            new SymbolInfo("NSE:VSTIND", "VST IND"),
            new SymbolInfo("NSE:JUBLINGRE", "JUBILANT INGRE"),
            new SymbolInfo("NSE:ASTERDM", "ASTER DM HEALTH"),
            new SymbolInfo("NSE:KRBL", "KRBL"),
            new SymbolInfo("NSE:LTTS", "L&T TECH SERV"),
            new SymbolInfo("NSE:INDIAMART", "INDIA MART"),
            new SymbolInfo("NSE:NYKAA", "NYKAA"),
            new SymbolInfo("NSE:GODREJPROP", "GODREJ PROP"),
            new SymbolInfo("NSE:PHOENIXLTD", "PHOENIX MILLS"),
            new SymbolInfo("NSE:OBEROIRLTY", "OBEROI REALTY"),
            new SymbolInfo("NSE:PRESTIGE", "PRESTIGE ESTATE"),
            new SymbolInfo("NSE:MACROTECH", "MACROTECH DEV"),
            new SymbolInfo("NSE:SOBHA", "SOBHA"),
            new SymbolInfo("NSE:BRIGADE", "BRIGADE ENTERPRISE"),
            new SymbolInfo("NSE:SUNFLAG", "SUNFLAG IRON"),
            new SymbolInfo("NSE:GODREJIND", "GODREJ INDUSTRY"),
            new SymbolInfo("NSE:FINPIPE", "FINPIPE"),
            new SymbolInfo("NSE:SUPREMEIND", "SUPREME IND"),
            new SymbolInfo("NSE:ASTRA", "ASTRA MICROWAVE"),
            new SymbolInfo("NSE:CENTURYPLY", "CENTURY PLY"),
            new SymbolInfo("NSE:GREENPANEL", "GREENPANEL"),
            new SymbolInfo("NSE:BLUESTARCO", "BLUE STAR"),
            new SymbolInfo("NSE:WHIRLPOOL", "WHIRLPOOL INDIA"),
            new SymbolInfo("NSE:ORIENTELEC", "ORIENT ELECTRIC"),
            new SymbolInfo("NSE:APARINDS", "APAR INDUSTRIES"),
            new SymbolInfo("NSE:THERMAX", "THERMAX"),
            new SymbolInfo("NSE:CARBORUNIV", "CARBORUNDUM"),
            new SymbolInfo("NSE:GRINDWELL", "GRINDWELL NORTON"),
            new SymbolInfo("NSE:SKFINDIA", "SKF INDIA"),
            new SymbolInfo("NSE:VGUARD", "V GUARD"),
            new SymbolInfo("NSE:TTKPRESTIGE", "TTK PRESTIGE"),
            new SymbolInfo("NSE:HAWKINCOOK", "HAWKINS COOK"),
            new SymbolInfo("NSE:BALRAMCHIN", "BALRAMPUR CHINI"),
            new SymbolInfo("NSE:TRIVENI", "TRIVENI ENGG"),
            new SymbolInfo("NSE:WABAG", "WABAG INDIA"),
            new SymbolInfo("NSE:VAIBHAVGBL", "VAIBHAV GLOBAL"),
            new SymbolInfo("NSE:VENKEYS", "VENKY'S INDIA"),
            new SymbolInfo("NSE:ZYDUSWELL", "ZYDUS WELLNESS"),
            new SymbolInfo("NSE:ALKALI", "ALKALI METALS"),
            new SymbolInfo("NSE:SUVEN", "SUVEN LIFE"),
            new SymbolInfo("NSE:BLISSGVS", "BLISS GVS"),
            new SymbolInfo("NSE:SHILPAMED", "SHILPA MEDICARE"),
            new SymbolInfo("NSE:SASTASUNDR", "SASTA SUNDAR"),
            new SymbolInfo("NSE:KABRAEXTRU", "KABRA EXTRUSION"),
            new SymbolInfo("NSE:STERLING", "STERLING WILSON"),
            new SymbolInfo("NSE:ZFCVINDIA", "ZF COMMERCIAL"),
            new SymbolInfo("NSE:SETCO", "SETCO AUTO"),
            new SymbolInfo("NSE:SUVENPHARMA", "SUVEN PHARMA"),
            new SymbolInfo("NSE:ORIENTCEM", "ORIENT CEMENT"),
            new SymbolInfo("NSE:SAGCEM", "SAGAR CEMENT"),
            new SymbolInfo("NSE:MANAKSIA", "MANAKSIA STEEL"),
            new SymbolInfo("NSE:MMTC", "MMTC"),
            new SymbolInfo("NSE:STCINDIA", "STC INDIA"),
            new SymbolInfo("NSE:MTARTECH", "MTAR TECH"),
            new SymbolInfo("NSE:PARADEEP", "PARADEEP PHOS"),
            new SymbolInfo("NSE:DCMSHRIRAM", "DCM SHRIRAM"),
            new SymbolInfo("NSE:GHCL", "GHCL"),
            new SymbolInfo("NSE:INDOCO", "INDOCO REMEDIES"),
            new SymbolInfo("NSE:JAICORPLTD", "JAI CORP"),
            new SymbolInfo("NSE:KECL", "KECL"),
            new SymbolInfo("NSE:KEIIND", "KEI INDUSTRIES"),
            new SymbolInfo("NSE:KPIL", "KALPATARU POWER"),
            new SymbolInfo("NSE:KSCL", "KAVERI SEED"),
            new SymbolInfo("NSE:MAHSCOOTER", "MAHINDRA SCOOTER"),
            new SymbolInfo("NSE:POLYMED", "POLYMEDICURE"),
            new SymbolInfo("NSE:RAJESHEXPO", "RAJESH EXPORTS"),
            new SymbolInfo("NSE:RIIL", "RELIANCE IND INFRA"),
            new SymbolInfo("NSE:SUNTECK", "SUNTECK REALTY"),
            new SymbolInfo("NSE:VARROC", "VARROC ENGINEERING"),
            new SymbolInfo("NSE:WOCKPHARMA", "WOCKHARDT")
        )),
        new SymbolGroup("NSE Indices", List.of(
            new SymbolInfo("NSE:NIFTY 50", "NIFTY 50"),
            new SymbolInfo("NSE:NIFTY BANK", "NIFTY BANK"),
            new SymbolInfo("NSE:NIFTY IT", "NIFTY IT"),
            new SymbolInfo("NSE:NIFTY NEXT 50", "NIFTY NEXT 50"),
            new SymbolInfo("NSE:NIFTY MIDCAP 100", "NIFTY MIDCAP 100"),
            new SymbolInfo("NSE:NIFTY SMALLCAP 50", "NIFTY SMALLCAP 50"),
            new SymbolInfo("NSE:NIFTY 500", "NIFTY 500"),
            new SymbolInfo("NSE:NIFTY AUTO", "NIFTY AUTO"),
            new SymbolInfo("NSE:NIFTY PHARMA", "NIFTY PHARMA"),
            new SymbolInfo("NSE:NIFTY FMCG", "NIFTY FMCG"),
            new SymbolInfo("NSE:NIFTY METAL", "NIFTY METAL"),
            new SymbolInfo("NSE:NIFTY REALTY", "NIFTY REALTY"),
            new SymbolInfo("NSE:NIFTY MEDIA", "NIFTY MEDIA"),
            new SymbolInfo("NSE:NIFTY ENERGY", "NIFTY ENERGY"),
            new SymbolInfo("NSE:NIFTY CONSUMPTION", "NIFTY CONSUMPTION"),
            new SymbolInfo("NSE:NIFTY INFRA", "NIFTY INFRA"),
            new SymbolInfo("NSE:NIFTY MNC", "NIFTY MNC"),
            new SymbolInfo("NSE:NIFTY PSU BANK", "NIFTY PSU BANK"),
            new SymbolInfo("NSE:NIFTY PVT BANK", "NIFTY PVT BANK"),
            new SymbolInfo("NSE:NIFTY SERV SECTOR", "NIFTY SERVICES"),
            new SymbolInfo("NSE:NIFTY FIN SERVICE", "NIFTY FINANCIAL"),
            new SymbolInfo("NSE:NIFTY HEALTHCARE", "NIFTY HEALTHCARE"),
            new SymbolInfo("NSE:NIFTY OIL & GAS", "NIFTY OIL & GAS"),
            new SymbolInfo("NSE:NIFTY COMMODITIES", "NIFTY COMMODITIES"),
            new SymbolInfo("NSE:NIFTY INDIA DIGITAL", "NIFTY DIGITAL"),
            new SymbolInfo("NSE:INDIA VIX", "INDIA VIX")
        )),
        new SymbolGroup("MCX Commodities", List.of(
            new SymbolInfo("MCX:GOLD", "GOLD"),
            new SymbolInfo("MCX:GOLDM", "GOLD MINI"),
            new SymbolInfo("MCX:GOLDGUINEA", "GOLD GUINEA"),
            new SymbolInfo("MCX:GOLDPETAL", "GOLD 1 GRAM"),
            new SymbolInfo("MCX:SILVER", "SILVER"),
            new SymbolInfo("MCX:SILVERM", "SILVER MICRO"),
            new SymbolInfo("MCX:SILVERMC", "SILVER MINI"),
            new SymbolInfo("MCX:CRUDEOIL", "CRUDE OIL"),
            new SymbolInfo("MCX:NATURALGAS", "NATURAL GAS"),
            new SymbolInfo("MCX:COPPER", "COPPER"),
            new SymbolInfo("MCX:ZINC", "ZINC"),
            new SymbolInfo("MCX:LEAD", "LEAD"),
            new SymbolInfo("MCX:LEADMINI", "LEAD MINI"),
            new SymbolInfo("MCX:ALUMINIUM", "ALUMINIUM"),
            new SymbolInfo("MCX:ALUMINIUMMINI", "ALUMINIUM MINI"),
            new SymbolInfo("MCX:NICKEL", "NICKEL"),
            new SymbolInfo("MCX:COTTON", "COTTON"),
            new SymbolInfo("MCX:CPO", "CRUDE PALM OIL"),
            new SymbolInfo("MCX:MENTHAOIL", "MENTHA OIL"),
            new SymbolInfo("MCX:CARDAMOM", "CARDAMOM"),
            new SymbolInfo("MCX:CASTORSEED", "CASTOR SEED"),
            new SymbolInfo("MCX:JEERA", "JEERA"),
            new SymbolInfo("MCX:TURMERIC", "TURMERIC"),
            new SymbolInfo("MCX:CHANA", "CHANA"),
            new SymbolInfo("MCX:DHANIYA", "DHANIYA"),
            new SymbolInfo("MCX:KAPAS", "KAPAS"),
            new SymbolInfo("MCX:MULTI", "MCX AGRI INDEX"),
            new SymbolInfo("MCX:ENERGY", "MCX ENERGY INDEX"),
            new SymbolInfo("MCX:METAL", "MCX METAL INDEX"),
            new SymbolInfo("MCX:BULLION", "MCX BULLION INDEX")
        )),
        new SymbolGroup("Global Indices", List.of(
            new SymbolInfo("GLOBAL:SPX", "S&P 500"),
            new SymbolInfo("GLOBAL:NDX", "NASDAQ 100"),
            new SymbolInfo("GLOBAL:IXIC", "NASDAQ COMPOSITE"),
            new SymbolInfo("GLOBAL:DJI", "DOW JONES"),
            new SymbolInfo("GLOBAL:NYA", "NYSE COMPOSITE"),
            new SymbolInfo("GLOBAL:RUT", "RUSSELL 2000"),
            new SymbolInfo("GLOBAL:VIX", "VIX VOLATILITY"),
            new SymbolInfo("GLOBAL:FTSE", "FTSE 100"),
            new SymbolInfo("GLOBAL:DAX", "DAX 40"),
            new SymbolInfo("GLOBAL:CAC", "CAC 40"),
            new SymbolInfo("GLOBAL:SX5E", "EURO STOXX 50"),
            new SymbolInfo("GLOBAL:STOXX", "STOXX 600"),
            new SymbolInfo("GLOBAL:N225", "NIKKEI 225"),
            new SymbolInfo("GLOBAL:HSI", "HANG SENG"),
            new SymbolInfo("GLOBAL:SHCOMP", "SHANGHAI COMPOSITE"),
            new SymbolInfo("GLOBAL:CSI300", "CSI 300"),
            new SymbolInfo("GLOBAL:KS11", "KOSPI"),
            new SymbolInfo("GLOBAL:ASX200", "ASX 200"),
            new SymbolInfo("GLOBAL:STI", "STRAITS TIMES"),
            new SymbolInfo("GLOBAL:TWII", "TAIEX"),
            new SymbolInfo("GLOBAL:NIFTY 50", "SGX NIFTY 50"),
            new SymbolInfo("GLOBAL:BOVESPA", "IBOVESPA"),
            new SymbolInfo("GLOBAL:MXX", "IPC MEXICO"),
            new SymbolInfo("GLOBAL:IMOEX", "MOEX RUSSIA"),
            new SymbolInfo("GLOBAL:JTOPI", "JAKARTA COMPOSITE"),
            new SymbolInfo("GLOBAL:SET50", "SET 50 THAILAND"),
            new SymbolInfo("GLOBAL:VNI", "VN INDEX"),
            new SymbolInfo("GLOBAL:FTSE EPRA", "FTSE EPRA REIT")
        ))
    );

    @GetMapping("/symbols")
    public List<SymbolGroup> symbols() {
        return SYMBOL_GROUPS;
    }

    @GetMapping("/providers")
    public List<Provider> providers() {
        return List.of(
            new Provider("DEMO", "Demo market feed", "Ready"),
            new Provider("ANGEL_ONE", "Angel One SmartAPI", "Connect credentials"),
            new Provider("ZERODHA", "Zerodha Kite Connect", "Connect credentials"),
            new Provider("UPSTOX", "Upstox API", "Connect credentials"),
            new Provider("FYERS", "Fyers API", "Connect credentials")
        );
    }

    @GetMapping("/candles")
    public ResponseEntity<?> candles(@RequestParam(defaultValue = "DEMO") String provider,
                                     @RequestParam(defaultValue = "NSE:RELIANCE") String symbol,
                                     @RequestParam(defaultValue = "1d") String interval,
                                     @RequestParam(defaultValue = "180") int limit,
                                     @RequestParam(required = false) Long from,
                                     @RequestParam(required = false) Long to,
                                     HttpSession session) {
        String safeProvider = provider.toUpperCase(Locale.ROOT);
        if (!PROVIDERS.contains(safeProvider)) return ResponseEntity.badRequest().body("Unknown provider");
        if (!INTERVALS.contains(interval)) return ResponseEntity.badRequest().body("Unsupported interval");
        int count = Math.clamp(limit, 20, 5000);
        List<Candle> candles = null;
        if (!"DEMO".equals(safeProvider)) {
            candles = brokerCandleService.fetchCandles(safeProvider, symbol, interval, count, to, session);
        }
        if (candles == null) {
            if (from != null && to != null) {
                candles = brokerCandleService.generateDemoRange(symbol, interval, from * 1000, to * 1000, count);
            } else if (to != null) {
                candles = brokerCandleService.generateDemoTo(symbol, interval, count, to * 1000);
            } else {
                candles = brokerCandleService.generateDemo(symbol, interval, count);
            }
        }
        if (from != null) {
            candles = candles.stream().filter(candle -> candle.time() >= from * 1000).toList();
        }
        return ResponseEntity.ok(new CandleResponse(safeProvider, symbol.toUpperCase(Locale.ROOT), interval, candles));
    }

    @GetMapping("/live-candle")
    public ResponseEntity<?> liveCandle(@RequestParam(defaultValue = "DEMO") String provider,
                                        @RequestParam(defaultValue = "NSE:RELIANCE") String symbol,
                                        @RequestParam(defaultValue = "1d") String interval,
                                        HttpSession session) {
        String safeProvider = provider.toUpperCase(Locale.ROOT);
        if (!PROVIDERS.contains(safeProvider) || !INTERVALS.contains(interval)) {
            return ResponseEntity.badRequest().body("Unknown provider or interval");
        }
        if (!"DEMO".equals(safeProvider)) {
            Candle live = brokerCandleService.fetchLiveQuote(safeProvider, symbol, interval, 2, session);
            if (live != null) return ResponseEntity.ok(live);
            List<Candle> history = brokerCandleService.fetchCandles(safeProvider, symbol, interval, 2, session);
            if (history != null && !history.isEmpty()) {
                Candle last = history.getLast();
                double delta = (new Random(System.nanoTime()).nextDouble() - .5) * Math.max(last.close() * .0015, .05);
                double close = round(Math.max(.01, last.close() + delta));
                Candle updated = new Candle(last.time(), last.open(), round(Math.max(last.high(), close)),
                    round(Math.min(last.low(), close)), close, last.volume() + 100 + new Random().nextInt(4000));
                return ResponseEntity.ok(updated);
            }
            return ResponseEntity.status(503).body("Broker data unavailable. Check connection.");
        }
        String key = symbol.toUpperCase(Locale.ROOT) + ":" + interval;
        Candle previous = liveCandles.computeIfAbsent(key, ignored -> {
            List<Candle> h = brokerCandleService.generateDemo(symbol, interval, 2);
            return h.getLast();
        });
        double delta = (new Random(System.nanoTime()).nextDouble() - .5) * Math.max(previous.close() * .0015, .05);
        double close = round(Math.max(.01, previous.close() + delta));
        Candle updated = new Candle(previous.time(), previous.open(), round(Math.max(previous.high(), close)),
            round(Math.min(previous.low(), close)), close, previous.volume() + 100 + new Random().nextInt(4000));
        liveCandles.put(key, updated);
        return ResponseEntity.ok(updated);
    }

    private double round(double n) { return Math.round(n * 100.0) / 100.0; }

    public record Provider(String id, String name, String status) {}
    public record SymbolInfo(String value, String label) {}
    public record SymbolGroup(String category, List<SymbolInfo> symbols) {}
    public record Candle(long time, double open, double high, double low, double close, long volume) {}
    public record CandleResponse(String provider, String symbol, String interval, List<Candle> candles) {}
}
