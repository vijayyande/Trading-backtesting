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
                new SymbolGroup("NIFTY 50", List.of(
            new SymbolInfo("NSE:ADANIENT", "ADANI ENT"),
            new SymbolInfo("NSE:ADANIPORTS", "ADANI PORTS"),
            new SymbolInfo("NSE:APOLLOHOSP", "APOLLO HOSP"),
            new SymbolInfo("NSE:ASIANPAINT", "ASIAN PAINTS"),
            new SymbolInfo("NSE:AXISBANK", "AXIS BANK"),
            new SymbolInfo("NSE:BAJAJ-AUTO", "BAJAJ AUTO"),
            new SymbolInfo("NSE:BAJFINANCE", "BAJAJ FINANCE"),
            new SymbolInfo("NSE:BAJAJFINSV", "BAJAJ FINSERV"),
            new SymbolInfo("NSE:BEL", "BEL"),
            new SymbolInfo("NSE:BHARTIARTL", "BHARTI AIRTEL"),
            new SymbolInfo("NSE:CIPLA", "CIPLA"),
            new SymbolInfo("NSE:COALINDIA", "COAL INDIA"),
            new SymbolInfo("NSE:DRREDDY", "DR REDDY'S"),
            new SymbolInfo("NSE:EICHERMOT", "EICHER MOTORS"),
            new SymbolInfo("NSE:ETERNAL", "ETERNAL"),
            new SymbolInfo("NSE:GRASIM", "GRASIM"),
            new SymbolInfo("NSE:HCLTECH", "HCL TECH"),
            new SymbolInfo("NSE:HDFCBANK", "HDFC BANK"),
            new SymbolInfo("NSE:HDFCLIFE", "HDFC LIFE"),
            new SymbolInfo("NSE:HEROMOTOCO", "HERO MOTOCORP"),
            new SymbolInfo("NSE:HINDALCO", "HINDALCO"),
            new SymbolInfo("NSE:HINDUNILVR", "HIND UNILEVER"),
            new SymbolInfo("NSE:ICICIBANK", "ICICI BANK"),
            new SymbolInfo("NSE:INDUSINDBK", "INDUSIND BANK"),
            new SymbolInfo("NSE:INFY", "INFOSYS"),
            new SymbolInfo("NSE:ITC", "ITC"),
            new SymbolInfo("NSE:JIOFIN", "JIO FIN SERVICES"),
            new SymbolInfo("NSE:JSWSTEEL", "JSW STEEL"),
            new SymbolInfo("NSE:KOTAKBANK", "KOTAK BANK"),
            new SymbolInfo("NSE:LT", "L&T"),
            new SymbolInfo("NSE:M&M", "M&M"),
            new SymbolInfo("NSE:MARUTI", "MARUTI SUZUKI"),
            new SymbolInfo("NSE:NESTLE", "NESTLE INDIA"),
            new SymbolInfo("NSE:NTPC", "NTPC"),
            new SymbolInfo("NSE:ONGC", "ONGC"),
            new SymbolInfo("NSE:POWERGRID", "POWER GRID"),
            new SymbolInfo("NSE:RELIANCE", "RELIANCE"),
            new SymbolInfo("NSE:SBILIFE", "SBI LIFE"),
            new SymbolInfo("NSE:SBIN", "SBI"),
            new SymbolInfo("NSE:SHRIRAMFIN", "SHRIRAM FIN"),
            new SymbolInfo("NSE:SUNPHARMA", "SUN PHARMA"),
            new SymbolInfo("NSE:TATACONSUM", "TATA CONSUMER"),
            new SymbolInfo("NSE:TATAMOTORS", "TATA MOTORS"),
            new SymbolInfo("NSE:TATASTEEL", "TATA STEEL"),
            new SymbolInfo("NSE:TCS", "TCS"),
            new SymbolInfo("NSE:TECHM", "TECH MAHINDRA"),
            new SymbolInfo("NSE:TITAN", "TITAN"),
            new SymbolInfo("NSE:TRENT", "TRENT"),
            new SymbolInfo("NSE:ULTRACEMCO", "ULTRATECH CEMENT"),
            new SymbolInfo("NSE:WIPRO", "WIPRO")
        )),
        new SymbolGroup("NIFTY NEXT 50", List.of(
            new SymbolInfo("NSE:ABB", "ABB"),
            new SymbolInfo("NSE:ADANIENSOL", "ADANI ENERGY SOL"),
            new SymbolInfo("NSE:ADANIGREEN", "ADANI GREEN"),
            new SymbolInfo("NSE:ADANIPOWER", "ADANI POWER"),
            new SymbolInfo("NSE:AMBUJACEM", "AMBUJA CEMENT"),
            new SymbolInfo("NSE:BAJAJHLDNG", "BAJAJ HOLDINGS"),
            new SymbolInfo("NSE:BANKBARODA", "BANK OF BARODA"),
            new SymbolInfo("NSE:BOSCHLTD", "BOSCH"),
            new SymbolInfo("NSE:BPCL", "BPCL"),
            new SymbolInfo("NSE:BRITANNIA", "BRITANNIA"),
            new SymbolInfo("NSE:CANBK", "CANARA BANK"),
            new SymbolInfo("NSE:CGPOWER", "CG POWER"),
            new SymbolInfo("NSE:CHOLAFIN", "CHOLAMANDALAM"),
            new SymbolInfo("NSE:CUMMINSIND", "CUMMINS INDIA"),
            new SymbolInfo("NSE:DIVISLAB", "DIVI'S LAB"),
            new SymbolInfo("NSE:DLF", "DLF"),
            new SymbolInfo("NSE:DMART", "DMART"),
            new SymbolInfo("NSE:ENRIN", "SIEMENS ENERGY"),
            new SymbolInfo("NSE:GAIL", "GAIL"),
            new SymbolInfo("NSE:GODREJCP", "GODREJ CP"),
            new SymbolInfo("NSE:HAL", "HAL"),
            new SymbolInfo("NSE:HDFCAMC", "HDFC AMC"),
            new SymbolInfo("NSE:HINDZINC", "HIND ZINC"),
            new SymbolInfo("NSE:HYUNDAI", "HYUNDAI MOTOR"),
            new SymbolInfo("NSE:INDHOTEL", "INDIAN HOTELS"),
            new SymbolInfo("NSE:IOC", "IOC"),
            new SymbolInfo("NSE:IRFC", "IRFC"),
            new SymbolInfo("NSE:JINDALSTEL", "JINDAL STEEL"),
            new SymbolInfo("NSE:LODHA", "LODHA"),
            new SymbolInfo("NSE:LTIM", "LTIMINDTREE"),
            new SymbolInfo("NSE:MAZDOCK", "MAZAGON DOCK"),
            new SymbolInfo("NSE:MOTHERSON", "SAMVARDHANA"),
            new SymbolInfo("NSE:MUTHOOTFIN", "MUTHOOT FINANCE"),
            new SymbolInfo("NSE:PFC", "PFC"),
            new SymbolInfo("NSE:PIDILITIND", "PIDILITE"),
            new SymbolInfo("NSE:PNB", "PNB"),
            new SymbolInfo("NSE:RECLTD", "REC"),
            new SymbolInfo("NSE:SHREECEM", "SHREE CEMENT"),
            new SymbolInfo("NSE:SIEMENS", "SIEMENS"),
            new SymbolInfo("NSE:SOLARINDS", "SOLAR IND"),
            new SymbolInfo("NSE:TATACAP", "TATA CAPITAL"),
            new SymbolInfo("NSE:TATAPOWER", "TATA POWER"),
            new SymbolInfo("NSE:TORNTPHARM", "TORNTE PHARMA"),
            new SymbolInfo("NSE:TVSMOTOR", "TVS MOTOR"),
            new SymbolInfo("NSE:UNIONBANK", "UNION BANK"),
            new SymbolInfo("NSE:UNITDSPR", "UNITED SPIRITS"),
            new SymbolInfo("NSE:VBL", "VARUN BEVERAGES"),
            new SymbolInfo("NSE:VEDL", "VEDANTA"),
            new SymbolInfo("NSE:ZYDUSLIFE", "ZYDUS LIFE")
        )),
        new SymbolGroup("NIFTY MIDCAP 100", List.of(
            new SymbolInfo("NSE:ABCAPITAL", "ADITYA BIRLA CAP"),
            new SymbolInfo("NSE:ABFRL", "ABHILASH FUTURE"),
            new SymbolInfo("NSE:ACC", "ACC"),
            new SymbolInfo("NSE:ALKEM", "ALKEM LABS"),
            new SymbolInfo("NSE:APLAPOLLO", "APL APOLLO TUBES"),
            new SymbolInfo("NSE:APOLLOTYRE", "APOLLO TYRES"),
            new SymbolInfo("NSE:ASHOKLEY", "ASHOK LEYLAND"),
            new SymbolInfo("NSE:ASTRAL", "ASTRAL"),
            new SymbolInfo("NSE:ADANITOTAL", "ADANI TOTAL GAS"),
            new SymbolInfo("NSE:AUBANK", "AU SMALL FIN BANK"),
            new SymbolInfo("NSE:AUROPHARMA", "AUROBINDO PHARMA"),
            new SymbolInfo("NSE:BANDHANBNK", "BANDHAN BANK"),
            new SymbolInfo("NSE:BANKINDIA", "BANK OF INDIA"),
            new SymbolInfo("NSE:BDL", "BDL"),
            new SymbolInfo("NSE:BHARATFORG", "BHARAT FORGE"),
            new SymbolInfo("NSE:BHARTIHEXA", "BHARTI HEXACOM"),
            new SymbolInfo("NSE:BHEL", "BHEL"),
            new SymbolInfo("NSE:BIOCON", "BIOCON"),
            new SymbolInfo("NSE:BLUESTARCO", "BLUE STAR"),
            new SymbolInfo("NSE:BSE", "BSE"),
            new SymbolInfo("NSE:COCHINSHIP", "COCHIN SHIPYARD"),
            new SymbolInfo("NSE:COFORGE", "COFORGE"),
            new SymbolInfo("NSE:COLPAL", "COLGATE"),
            new SymbolInfo("NSE:CONCOR", "CONTAINER CORP"),
            new SymbolInfo("NSE:COROMANDEL", "COROMANDEL"),
            new SymbolInfo("NSE:CUMMINSIND", "CUMMINS INDIA"),
            new SymbolInfo("NSE:DABUR", "DABUR"),
            new SymbolInfo("NSE:DIXON", "DIXON TECH"),
            new SymbolInfo("NSE:ESCORTS", "ESCORTS"),
            new SymbolInfo("NSE:EXIDEIND", "EXIDE IND"),
            new SymbolInfo("NSE:FEDERALBNK", "FEDERAL BANK"),
            new SymbolInfo("NSE:GLENMARK", "GLENMARK PHARMA"),
            new SymbolInfo("NSE:GMRAIRPORT", "GMR AIRPORTS"),
            new SymbolInfo("NSE:GODREJPROP", "GODREJ PROP"),
            new SymbolInfo("NSE:HAVELLS", "HAVELLS"),
            new SymbolInfo("NSE:HDFCAMC", "HDFC AMC"),
            new SymbolInfo("NSE:HINDPETRO", "HINDUSTAN PETRO"),
            new SymbolInfo("NSE:HINDZINC", "HIND ZINC"),
            new SymbolInfo("NSE:HITACHIENERGY", "HITACHI ENERGY"),
            new SymbolInfo("NSE:HUDCO", "HUDCO"),
            new SymbolInfo("NSE:IDEA", "VODAFONE IDEA"),
            new SymbolInfo("NSE:IDFCFIRSTB", "IDFC FIRST BANK"),
            new SymbolInfo("NSE:IGL", "INDRAPRASTHA GAS"),
            new SymbolInfo("NSE:INDIANB", "INDIAN BANK"),
            new SymbolInfo("NSE:INDUSTOWER", "INDUS TOWERS"),
            new SymbolInfo("NSE:IRB", "IRB INFRA"),
            new SymbolInfo("NSE:IRCTC", "IRCTC"),
            new SymbolInfo("NSE:IREDA", "IREDA"),
            new SymbolInfo("NSE:JSWENERGY", "JSW ENERGY"),
            new SymbolInfo("NSE:JUBLFOOD", "JUBILANT FOOD"),
            new SymbolInfo("NSE:KALYANKJIL", "KALYAN JEWELLERS"),
            new SymbolInfo("NSE:KEIIND", "KEI INDUSTRIES"),
            new SymbolInfo("NSE:KPITTECH", "KPIT TECH"),
            new SymbolInfo("NSE:LAURUSLABS", "LAURUS LABS"),
            new SymbolInfo("NSE:LICHSGFIN", "LIC HOUSING FIN"),
            new SymbolInfo("NSE:LTF", "L&T FINANCE"),
            new SymbolInfo("NSE:LUPIN", "LUPIN"),
            new SymbolInfo("NSE:M&MFIN", "M&M FIN"),
            new SymbolInfo("NSE:MAHABANK", "MAHA BANK"),
            new SymbolInfo("NSE:MANKIND", "MANKIND PHARMA"),
            new SymbolInfo("NSE:MARICO", "MARICO"),
            new SymbolInfo("NSE:MAXHEALTH", "MAX HEALTHCARE"),
            new SymbolInfo("NSE:MAZDOCK", "MAZAGON DOCK"),
            new SymbolInfo("NSE:MCX", "MCX"),
            new SymbolInfo("NSE:MFSL", "MAX FIN"),
            new SymbolInfo("NSE:MOTILALOFS", "MOTILAL OSWAL"),
            new SymbolInfo("NSE:MPHASIS", "MPHASIS"),
            new SymbolInfo("NSE:MRF", "MRF"),
            new SymbolInfo("NSE:MUTHOOTFIN", "MUTHOOT FINANCE"),
            new SymbolInfo("NSE:NATIONALUM", "NATIONAL ALUM"),
            new SymbolInfo("NSE:NHPC", "NHPC"),
            new SymbolInfo("NSE:NMDC", "NMDC"),
            new SymbolInfo("NSE:NTPCGREEN", "NTPC GREEN"),
            new SymbolInfo("NSE:OBEROIRLTY", "OBEROI REALTY"),
            new SymbolInfo("NSE:OFSS", "ORACLE FIN SER"),
            new SymbolInfo("NSE:OIL", "OIL INDIA"),
            new SymbolInfo("NSE:OLAELEC", "OLA ELECTRIC"),
            new SymbolInfo("NSE:PAGEIND", "PAGE IND"),
            new SymbolInfo("NSE:PATANJALI", "PATANJALI"),
            new SymbolInfo("NSE:PAYTM", "PAYTM"),
            new SymbolInfo("NSE:PERSISTENT", "PERSISTENT SYS"),
            new SymbolInfo("NSE:PETRONET", "PETRONET LNG"),
            new SymbolInfo("NSE:PHOENIXLTD", "PHOENIX MILLS"),
            new SymbolInfo("NSE:PIIND", "PI INDUSTRIES"),
            new SymbolInfo("NSE:POLICYBZR", "PB FINTECH"),
            new SymbolInfo("NSE:POLYCAB", "POLYCAB"),
            new SymbolInfo("NSE:PREMIERENE", "PREMIER ENERGIES"),
            new SymbolInfo("NSE:PRESTIGE", "PRESTIGE ESTATE"),
            new SymbolInfo("NSE:RVNL", "RAIL VIKAS"),
            new SymbolInfo("NSE:SAIL", "SAIL"),
            new SymbolInfo("NSE:SBICARD", "SBI CARDS"),
            new SymbolInfo("NSE:SJVN", "SJVN"),
            new SymbolInfo("NSE:SOLARINDS", "SOLAR IND"),
            new SymbolInfo("NSE:SONACOMS", "SONA BLW"),
            new SymbolInfo("NSE:SRF", "SRF"),
            new SymbolInfo("NSE:SUPREMEIND", "SUPREME IND"),
            new SymbolInfo("NSE:SUZLON", "SUZLON ENERGY"),
            new SymbolInfo("NSE:SWIGGY", "SWIGGY"),
            new SymbolInfo("NSE:TATACOMM", "TATA COMMS"),
            new SymbolInfo("NSE:TATAELXSI", "TATA ELXSI"),
            new SymbolInfo("NSE:TATATECH", "TATA TECH"),
            new SymbolInfo("NSE:TATAINVEST", "TATA INVEST"),
            new SymbolInfo("NSE:TIINDIA", "TI INDIA"),
            new SymbolInfo("NSE:TORNTPOWER", "TORNTE POWER"),
            new SymbolInfo("NSE:UNIONBANK", "UNION BANK"),
            new SymbolInfo("NSE:UPL", "UPL"),
            new SymbolInfo("NSE:VMM", "VISHAL MEGA MART"),
            new SymbolInfo("NSE:VOLTAS", "VOLTAS"),
            new SymbolInfo("NSE:WAAREEENERGIES", "WAAREE ENERGY"),
            new SymbolInfo("NSE:YESBANK", "YES BANK")
        )),
        new SymbolGroup("NIFTY BANK", List.of(
            new SymbolInfo("NSE:AXISBANK", "AXIS BANK"),
            new SymbolInfo("NSE:BANDHANBNK", "BANDHAN BANK"),
            new SymbolInfo("NSE:BANKBARODA", "BANK OF BARODA"),
            new SymbolInfo("NSE:CANBK", "CANARA BANK"),
            new SymbolInfo("NSE:FEDERALBNK", "FEDERAL BANK"),
            new SymbolInfo("NSE:HDFCBANK", "HDFC BANK"),
            new SymbolInfo("NSE:ICICIBANK", "ICICI BANK"),
            new SymbolInfo("NSE:IDFCFIRSTB", "IDFC FIRST BANK"),
            new SymbolInfo("NSE:INDUSINDBK", "INDUSIND BANK"),
            new SymbolInfo("NSE:KOTAKBANK", "KOTAK BANK"),
            new SymbolInfo("NSE:PNB", "PNB"),
            new SymbolInfo("NSE:SBIN", "SBI")
        )),
        new SymbolGroup("NIFTY IT", List.of(
            new SymbolInfo("NSE:TCS", "TCS"),
            new SymbolInfo("NSE:INFY", "INFOSYS"),
            new SymbolInfo("NSE:HCLTECH", "HCL TECH"),
            new SymbolInfo("NSE:WIPRO", "WIPRO"),
            new SymbolInfo("NSE:TECHM", "TECH MAHINDRA"),
            new SymbolInfo("NSE:LTIM", "LTIMINDTREE"),
            new SymbolInfo("NSE:COFORGE", "COFORGE"),
            new SymbolInfo("NSE:PERSISTENT", "PERSISTENT SYS"),
            new SymbolInfo("NSE:MPHASIS", "MPHASIS"),
            new SymbolInfo("NSE:LTTS", "L&T TECH SERV")
        )),
        new SymbolGroup("NIFTY AUTO", List.of(
            new SymbolInfo("NSE:ASHOKLEY", "ASHOK LEYLAND"),
            new SymbolInfo("NSE:APOLLOTYRE", "APOLLO TYRES"),
            new SymbolInfo("NSE:BAJAJ-AUTO", "BAJAJ AUTO"),
            new SymbolInfo("NSE:BALKRISIND", "BALKRISHNA IND"),
            new SymbolInfo("NSE:BHARATFORG", "BHARAT FORGE"),
            new SymbolInfo("NSE:CEATLTD", "CEAT"),
            new SymbolInfo("NSE:EICHERMOT", "EICHER MOTORS"),
            new SymbolInfo("NSE:ESCORTS", "ESCORTS"),
            new SymbolInfo("NSE:EXIDEIND", "EXIDE IND"),
            new SymbolInfo("NSE:HEROMOTOCO", "HERO MOTOCORP"),
            new SymbolInfo("NSE:M&M", "M&M"),
            new SymbolInfo("NSE:MARUTI", "MARUTI SUZUKI"),
            new SymbolInfo("NSE:MOTHERSON", "SAMVARDHANA"),
            new SymbolInfo("NSE:MRF", "MRF"),
            new SymbolInfo("NSE:OLAELEC", "OLA ELECTRIC"),
            new SymbolInfo("NSE:SONACOMS", "SONA BLW"),
            new SymbolInfo("NSE:TATAMOTORS", "TATA MOTORS"),
            new SymbolInfo("NSE:TIINDIA", "TI INDIA"),
            new SymbolInfo("NSE:TVSMOTOR", "TVS MOTOR"),
            new SymbolInfo("NSE:AMARAJABAT", "AMARA RAJA BAT")
        )),
        new SymbolGroup("NIFTY PHARMA", List.of(
            new SymbolInfo("NSE:ABBOTINDIA", "ABBOTT INDIA"),
            new SymbolInfo("NSE:ALKEM", "ALKEM LABS"),
            new SymbolInfo("NSE:AUROPHARMA", "AUROBINDO PHARMA"),
            new SymbolInfo("NSE:BIOCON", "BIOCON"),
            new SymbolInfo("NSE:CADILAHC", "CADILA HC"),
            new SymbolInfo("NSE:CIPLA", "CIPLA"),
            new SymbolInfo("NSE:DIVISLAB", "DIVI'S LAB"),
            new SymbolInfo("NSE:DRREDDY", "DR REDDY'S"),
            new SymbolInfo("NSE:GLENMARK", "GLENMARK PHARMA"),
            new SymbolInfo("NSE:GRANULES", "GRANULES INDIA"),
            new SymbolInfo("NSE:IPCALAB", "IPCA LABS"),
            new SymbolInfo("NSE:JBCHEPHARM", "JB CHEMICALS"),
            new SymbolInfo("NSE:LAURUSLABS", "LAURUS LABS"),
            new SymbolInfo("NSE:LUPIN", "LUPIN"),
            new SymbolInfo("NSE:MANKIND", "MANKIND PHARMA"),
            new SymbolInfo("NSE:NATCOPHARM", "NATCO PHARMA"),
            new SymbolInfo("NSE:PFIZER", "PFIZER"),
            new SymbolInfo("NSE:SANOFI", "SANOFI INDIA"),
            new SymbolInfo("NSE:SHILPAMED", "SHILPA MEDICARE"),
            new SymbolInfo("NSE:SUNPHARMA", "SUN PHARMA"),
            new SymbolInfo("NSE:TORNTPHARM", "TORNTE PHARMA"),
            new SymbolInfo("NSE:WOCKPHARMA", "WOCKHARDT"),
            new SymbolInfo("NSE:ZYDUSLIFE", "ZYDUS LIFE"),
            new SymbolInfo("NSE:ZYDUSWELL", "ZYDUS WELLNESS"),
            new SymbolInfo("NSE:GLAXO", "GLAXOSMITHKLINE")
        )),
        new SymbolGroup("NIFTY FMCG", List.of(
            new SymbolInfo("NSE:BATAINDIA", "BATA INDIA"),
            new SymbolInfo("NSE:BRITANNIA", "BRITANNIA"),
            new SymbolInfo("NSE:COLPAL", "COLGATE"),
            new SymbolInfo("NSE:DABUR", "DABUR"),
            new SymbolInfo("NSE:EMAMILTD", "EMAMI"),
            new SymbolInfo("NSE:GILLETTE", "GILLETTE INDIA"),
            new SymbolInfo("NSE:GODREJAGRO", "GODREJ AGRO"),
            new SymbolInfo("NSE:GODREJCP", "GODREJ CP"),
            new SymbolInfo("NSE:HINDUNILVR", "HIND UNILEVER"),
            new SymbolInfo("NSE:ITC", "ITC"),
            new SymbolInfo("NSE:KRBL", "KRBL"),
            new SymbolInfo("NSE:MARICO", "MARICO"),
            new SymbolInfo("NSE:METROBRAND", "METRO BRANDS"),
            new SymbolInfo("NSE:NESTLE", "NESTLE INDIA"),
            new SymbolInfo("NSE:PATANJALI", "PATANJALI"),
            new SymbolInfo("NSE:PGHL", "PROCTER & GAMBLE"),
            new SymbolInfo("NSE:RADICO", "RADICO KHAITAN"),
            new SymbolInfo("NSE:RELAXO", "RELAXO FOOTWEARS"),
            new SymbolInfo("NSE:TATACONSUM", "TATA CONSUMER"),
            new SymbolInfo("NSE:UNITDSPR", "UNITED SPIRITS"),
            new SymbolInfo("NSE:VBL", "VARUN BEVERAGES"),
            new SymbolInfo("NSE:VSTIND", "VST IND"),
            new SymbolInfo("NSE:BAJAJCON", "BAJAJ CONSUMER")
        )),
        new SymbolGroup("NIFTY METAL", List.of(
            new SymbolInfo("NSE:APLAPOLLO", "APL APOLLO TUBES"),
            new SymbolInfo("NSE:COALINDIA", "COAL INDIA"),
            new SymbolInfo("NSE:HINDALCO", "HINDALCO"),
            new SymbolInfo("NSE:HINDZINC", "HIND ZINC"),
            new SymbolInfo("NSE:JINDALSTEL", "JINDAL STEEL"),
            new SymbolInfo("NSE:JSWSTEEL", "JSW STEEL"),
            new SymbolInfo("NSE:MAHSEAMLES", "MAHARASHTRA SEAML"),
            new SymbolInfo("NSE:MOIL", "MOIL"),
            new SymbolInfo("NSE:NATIONALUM", "NATIONAL ALUM"),
            new SymbolInfo("NSE:NMDC", "NMDC"),
            new SymbolInfo("NSE:RATNAMANI", "RATNAMANI METAL"),
            new SymbolInfo("NSE:SAIL", "SAIL"),
            new SymbolInfo("NSE:TATASTEEL", "TATA STEEL"),
            new SymbolInfo("NSE:VEDL", "VEDANTA"),
            new SymbolInfo("NSE:WELCORP", "WELSPUN CORP")
        )),
        new SymbolGroup("NIFTY REALTY", List.of(
            new SymbolInfo("NSE:BRIGADE", "BRIGADE ENTERPRISE"),
            new SymbolInfo("NSE:DLF", "DLF"),
            new SymbolInfo("NSE:GODREJPROP", "GODREJ PROP"),
            new SymbolInfo("NSE:LODHA", "LODHA"),
            new SymbolInfo("NSE:MACROTECH", "MACROTECH DEV"),
            new SymbolInfo("NSE:OBEROIRLTY", "OBEROI REALTY"),
            new SymbolInfo("NSE:PHOENIXLTD", "PHOENIX MILLS"),
            new SymbolInfo("NSE:PRESTIGE", "PRESTIGE ESTATE"),
            new SymbolInfo("NSE:SOBHA", "SOBHA"),
            new SymbolInfo("NSE:SUNFLAG", "SUNFLAG IRON"),
            new SymbolInfo("NSE:SUNTECK", "SUNTECK REALTY")
        )),
        new SymbolGroup("NIFTY MEDIA", List.of(
            new SymbolInfo("NSE:NAZARA", "NAZARA TECH"),
            new SymbolInfo("NSE:NETWORK18", "NETWORK18"),
            new SymbolInfo("NSE:PVRINOX", "PVR INOX"),
            new SymbolInfo("NSE:SUNTV", "SUN TV"),
            new SymbolInfo("NSE:TV18BRDCST", "TV18 BROADCAST"),
            new SymbolInfo("NSE:ZEEL", "ZEE ENTERTAIN")
        )),
        new SymbolGroup("NIFTY ENERGY", List.of(
            new SymbolInfo("NSE:ADANIENSOL", "ADANI ENERGY SOL"),
            new SymbolInfo("NSE:ADANIGREEN", "ADANI GREEN"),
            new SymbolInfo("NSE:ADANIPOWER", "ADANI POWER"),
            new SymbolInfo("NSE:ADANITOTAL", "ADANI TOTAL GAS"),
            new SymbolInfo("NSE:ADANIWILMAR", "ADANI WILMAR"),
            new SymbolInfo("NSE:CESC", "CESC"),
            new SymbolInfo("NSE:GAIL", "GAIL"),
            new SymbolInfo("NSE:GUJGAS", "GUJARAT GAS"),
            new SymbolInfo("NSE:HPCL", "HPCL"),
            new SymbolInfo("NSE:IGL", "INDRAPRASTHA GAS"),
            new SymbolInfo("NSE:INOXWIND", "INOX WIND"),
            new SymbolInfo("NSE:IOC", "IOC"),
            new SymbolInfo("NSE:JSWENERGY", "JSW ENERGY"),
            new SymbolInfo("NSE:MGL", "MGL"),
            new SymbolInfo("NSE:NHPC", "NHPC"),
            new SymbolInfo("NSE:NTPC", "NTPC"),
            new SymbolInfo("NSE:NTPCGREEN", "NTPC GREEN"),
            new SymbolInfo("NSE:OIL", "OIL INDIA"),
            new SymbolInfo("NSE:ONGC", "ONGC"),
            new SymbolInfo("NSE:PETRONET", "PETRONET LNG"),
            new SymbolInfo("NSE:POWERGRID", "POWER GRID"),
            new SymbolInfo("NSE:RELIANCE", "RELIANCE"),
            new SymbolInfo("NSE:SJVN", "SJVN"),
            new SymbolInfo("NSE:SUZLON", "SUZLON ENERGY"),
            new SymbolInfo("NSE:TATAPOWER", "TATA POWER"),
            new SymbolInfo("NSE:TORNTPOWER", "TORNTE POWER")
        )),
        new SymbolGroup("NIFTY PSU BANK", List.of(
            new SymbolInfo("NSE:BANKBARODA", "BANK OF BARODA"),
            new SymbolInfo("NSE:BANKINDIA", "BANK OF INDIA"),
            new SymbolInfo("NSE:CANBK", "CANARA BANK"),
            new SymbolInfo("NSE:CENTRALBK", "CENTRAL BANK"),
            new SymbolInfo("NSE:IDBI", "IDBI BANK"),
            new SymbolInfo("NSE:INDIANB", "INDIAN BANK"),
            new SymbolInfo("NSE:MAHABANK", "MAHA BANK"),
            new SymbolInfo("NSE:PNB", "PNB"),
            new SymbolInfo("NSE:SBIN", "SBI"),
            new SymbolInfo("NSE:UNIONBANK", "UNION BANK")
        )),
        new SymbolGroup("NIFTY FIN SERVICE", List.of(
            new SymbolInfo("NSE:ANGELONE", "ANGEL ONE"),
            new SymbolInfo("NSE:AXISBANK", "AXIS BANK"),
            new SymbolInfo("NSE:BAJAJFINSV", "BAJAJ FINSERV"),
            new SymbolInfo("NSE:BAJFINANCE", "BAJAJ FINANCE"),
            new SymbolInfo("NSE:BAJAJHLDNG", "BAJAJ HOLDINGS"),
            new SymbolInfo("NSE:BSE", "BSE"),
            new SymbolInfo("NSE:CANFINHOME", "CAN FIN HOMES"),
            new SymbolInfo("NSE:CHOLAFIN", "CHOLAMANDALAM"),
            new SymbolInfo("NSE:CREDITACC", "CREDIT ACCESS"),
            new SymbolInfo("NSE:HDFCAMC", "HDFC AMC"),
            new SymbolInfo("NSE:HDFCLIFE", "HDFC LIFE"),
            new SymbolInfo("NSE:HUDCO", "HUDCO"),
            new SymbolInfo("NSE:ICICIBANK", "ICICI BANK"),
            new SymbolInfo("NSE:ICICIGI", "ICICI GI"),
            new SymbolInfo("NSE:ICICIPRULI", "ICICI PRU LIFE"),
            new SymbolInfo("NSE:ICICISEC", "ICICI SEC"),
            new SymbolInfo("NSE:IIFL", "IIFL FINANCE"),
            new SymbolInfo("NSE:IREDA", "IREDA"),
            new SymbolInfo("NSE:IRFC", "IRFC"),
            new SymbolInfo("NSE:KOTAKBANK", "KOTAK BANK"),
            new SymbolInfo("NSE:LICHSGFIN", "LIC HOUSING FIN"),
            new SymbolInfo("NSE:LTF", "L&T FINANCE"),
            new SymbolInfo("NSE:M&MFIN", "M&M FIN"),
            new SymbolInfo("NSE:MANAPPURAM", "MANAPPURAM"),
            new SymbolInfo("NSE:MCX", "MCX"),
            new SymbolInfo("NSE:MFSL", "MAX FIN"),
            new SymbolInfo("NSE:MOTILALOFS", "MOTILAL OSWAL"),
            new SymbolInfo("NSE:MUTHOOTFIN", "MUTHOOT FINANCE"),
            new SymbolInfo("NSE:PAYTM", "PAYTM"),
            new SymbolInfo("NSE:PFC", "PFC"),
            new SymbolInfo("NSE:POLICYBZR", "PB FINTECH"),
            new SymbolInfo("NSE:POONAWALLA", "POONAWALLA FIN"),
            new SymbolInfo("NSE:RECLTD", "REC"),
            new SymbolInfo("NSE:SBICARD", "SBI CARDS"),
            new SymbolInfo("NSE:SBILIFE", "SBI LIFE"),
            new SymbolInfo("NSE:SBIN", "SBI"),
            new SymbolInfo("NSE:SHRIRAMFIN", "SHRIRAM FIN"),
            new SymbolInfo("NSE:360ONE", "360 ONE WAM"),
            new SymbolInfo("NSE:ABCAPITAL", "ADITYA BIRLA CAP")
        )),
        new SymbolGroup("NIFTY HEALTHCARE", List.of(
            new SymbolInfo("NSE:ABBOTINDIA", "ABBOTT INDIA"),
            new SymbolInfo("NSE:APOLLOHOSP", "APOLLO HOSP"),
            new SymbolInfo("NSE:ASTERDM", "ASTER DM HEALTH"),
            new SymbolInfo("NSE:BIOCON", "BIOCON"),
            new SymbolInfo("NSE:CADILAHC", "CADILA HC"),
            new SymbolInfo("NSE:CIPLA", "CIPLA"),
            new SymbolInfo("NSE:DIVISLAB", "DIVI'S LAB"),
            new SymbolInfo("NSE:DRREDDY", "DR REDDY'S"),
            new SymbolInfo("NSE:FORTIS", "FORTIS HOSPITAL"),
            new SymbolInfo("NSE:GLENMARK", "GLENMARK PHARMA"),
            new SymbolInfo("NSE:LAURUSLABS", "LAURUS LABS"),
            new SymbolInfo("NSE:LUPIN", "LUPIN"),
            new SymbolInfo("NSE:MANKIND", "MANKIND PHARMA"),
            new SymbolInfo("NSE:MAXHEALTH", "MAX HEALTHCARE"),
            new SymbolInfo("NSE:MEDANTA", "MEDANTA HOSPITAL"),
            new SymbolInfo("NSE:METROPOLIS", "METROPOLIS"),
            new SymbolInfo("NSE:NATCOPHARM", "NATCO PHARMA"),
            new SymbolInfo("NSE:NH", "NARAYANA HRUDAYA"),
            new SymbolInfo("NSE:STARHEALTH", "STAR HEALTH"),
            new SymbolInfo("NSE:SUNPHARMA", "SUN PHARMA"),
            new SymbolInfo("NSE:TORNTPHARM", "TORNTE PHARMA"),
            new SymbolInfo("NSE:ZYDUSLIFE", "ZYDUS LIFE")
        )),
        new SymbolGroup("NIFTY INFRA", List.of(
            new SymbolInfo("NSE:ABB", "ABB"),
            new SymbolInfo("NSE:ADANIPORTS", "ADANI PORTS"),
            new SymbolInfo("NSE:BDL", "BDL"),
            new SymbolInfo("NSE:BEL", "BEL"),
            new SymbolInfo("NSE:CGPOWER", "CG POWER"),
            new SymbolInfo("NSE:GMRINFRA", "GMR INFRA"),
            new SymbolInfo("NSE:HAL", "HAL"),
            new SymbolInfo("NSE:IRB", "IRB INFRA"),
            new SymbolInfo("NSE:KALPATARU", "KALPATARU POWER"),
            new SymbolInfo("NSE:KECL", "KECL"),
            new SymbolInfo("NSE:KEIIND", "KEI INDUSTRIES"),
            new SymbolInfo("NSE:LARSEN", "L&T"),
            new SymbolInfo("NSE:LT", "L&T"),
            new SymbolInfo("NSE:NBCC", "NBCC"),
            new SymbolInfo("NSE:NCC", "NCC"),
            new SymbolInfo("NSE:NTPC", "NTPC"),
            new SymbolInfo("NSE:POWERGRID", "POWER GRID"),
            new SymbolInfo("NSE:RITES", "RITES"),
            new SymbolInfo("NSE:SIEMENS", "SIEMENS")
        )),
        new SymbolGroup("NSE Others", List.of(
            new SymbolInfo("NSE:ZOMATO", "ZOMATO"),
            new SymbolInfo("NSE:ADANITRANS", "ADANI TRANS"),
            new SymbolInfo("NSE:BERGEPAINT", "BERGER PAINTS"),
            new SymbolInfo("NSE:SRTRANSFIN", "SHRIRAM FIN"),
            new SymbolInfo("NSE:MCDOWELL-N", "MCDOWELL'S"),
            new SymbolInfo("NSE:AVENUE", "AVENUE SUPER"),
            new SymbolInfo("NSE:NAUKRI", "INFO EDGE"),
            new SymbolInfo("NSE:RBLBANK", "RBL BANK"),
            new SymbolInfo("NSE:SOUTHBANK", "SOUTH INDIAN BANK"),
            new SymbolInfo("NSE:EQUITASBNK", "EQUITAS BANK"),
            new SymbolInfo("NSE:KTKBANK", "KARNATAKA BANK"),
            new SymbolInfo("NSE:DCBBANK", "DCB BANK"),
            new SymbolInfo("NSE:CSBBANK", "CSB BANK"),
            new SymbolInfo("NSE:JSFB", "JANA SFB"),
            new SymbolInfo("NSE:UTKARSHBNK", "UTKARSH SFB"),
            new SymbolInfo("NSE:FIVESTAR", "FIVE STAR FIN"),
            new SymbolInfo("NSE:NAM-INDIA", "NIPPON AMC"),
            new SymbolInfo("NSE:MASFIN", "MAS FINANCIAL"),
            new SymbolInfo("NSE:SYMPHONY", "SYMPHONY"),
            new SymbolInfo("NSE:BAJAJELEC", "BAJAJ ELECTRICAL"),
            new SymbolInfo("NSE:CROMPTON", "CROMPTON GREAVES"),
            new SymbolInfo("NSE:KAJARIACER", "KAJARIA CERAMICS"),
            new SymbolInfo("NSE:PNBHOUSING", "PNB HOUSING"),
            new SymbolInfo("NSE:RAMCOCEM", "RAMCO CEMENT"),
            new SymbolInfo("NSE:JKCEMENT", "JK CEMENT"),
            new SymbolInfo("NSE:DALMIABHA", "DALMIA BHARAT"),
            new SymbolInfo("NSE:HEIDELBERG", "HEIDELBERGCEM"),
            new SymbolInfo("NSE:STARCEMENT", "STAR CEMENT"),
            new SymbolInfo("NSE:ASHOKA", "ASHOKA BUILDCON"),
            new SymbolInfo("NSE:PNCINFRA", "PNC INFRA"),
            new SymbolInfo("NSE:SADBHAV", "SADBHAV ENG"),
            new SymbolInfo("NSE:SUNDARMFIN", "SUNDARAM FINANCE"),
            new SymbolInfo("NSE:TVSHEETAL", "SHEETAL"),
            new SymbolInfo("NSE:ENGINERSIN", "ENGINEERS INDIA"),
            new SymbolInfo("NSE:MISHRA", "MISHRA DHATU"),
            new SymbolInfo("NSE:ADITYABIRL", "ADITYA BIRLA"),
            new SymbolInfo("NSE:HEXAWARE", "HEXAWARE TECH"),
            new SymbolInfo("NSE:CYIENT", "CYIENT"),
            new SymbolInfo("NSE:ZENSARTECH", "ZENSAR TECH"),
            new SymbolInfo("NSE:BSOFT", "BIRLA SOFT"),
            new SymbolInfo("NSE:NIITTECH", "NIIT TECH"),
            new SymbolInfo("NSE:LTI", "LTI"),
            new SymbolInfo("NSE:MINDACORP", "MINDA CORP"),
            new SymbolInfo("NSE:CASTROL", "CASTROL INDIA"),
            new SymbolInfo("NSE:GNFC", "GNFC"),
            new SymbolInfo("NSE:GSFC", "GSFC"),
            new SymbolInfo("NSE:CHAMBLFERT", "CHAMBAL FERT"),
            new SymbolInfo("NSE:RCF", "RCF"),
            new SymbolInfo("NSE:BAYERCROP", "BAYER CROPSCI"),
            new SymbolInfo("NSE:BASFINDIA", "BASF INDIA"),
            new SymbolInfo("NSE:DEEPAKNTR", "DEEPAK NITRITE"),
            new SymbolInfo("NSE:GUJALKALI", "GUJ ALKALIES"),
            new SymbolInfo("NSE:TATACHEM", "TATA CHEMS"),
            new SymbolInfo("NSE:VINATIORGA", "VINATI ORG"),
            new SymbolInfo("NSE:AARTIIND", "AARTI IND"),
            new SymbolInfo("NSE:NAVINFLUOR", "NAVIN FLUORINE"),
            new SymbolInfo("NSE:JUBLINGRE", "JUBILANT INGRE"),
            new SymbolInfo("NSE:INDIAMART", "INDIA MART"),
            new SymbolInfo("NSE:NYKAA", "NYKAA"),
            new SymbolInfo("NSE:GODREJIND", "GODREJ INDUSTRY"),
            new SymbolInfo("NSE:FINPIPE", "FINPIPE"),
            new SymbolInfo("NSE:ASTRA", "ASTRA MICROWAVE"),
            new SymbolInfo("NSE:CENTURYPLY", "CENTURY PLY"),
            new SymbolInfo("NSE:GREENPANEL", "GREENPANEL"),
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
            new SymbolInfo("NSE:ALKALI", "ALKALI METALS"),
            new SymbolInfo("NSE:SUVEN", "SUVEN LIFE"),
            new SymbolInfo("NSE:BLISSGVS", "BLISS GVS"),
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
            new SymbolInfo("NSE:KPIL", "KALPATARU POWER"),
            new SymbolInfo("NSE:KSCL", "KAVERI SEED"),
            new SymbolInfo("NSE:MAHSCOOTER", "MAHINDRA SCOOTER"),
            new SymbolInfo("NSE:POLYMED", "POLYMEDICURE"),
            new SymbolInfo("NSE:RAJESHEXPO", "RAJESH EXPORTS"),
            new SymbolInfo("NSE:RIIL", "RELIANCE IND INFRA"),
            new SymbolInfo("NSE:VARROC", "VARROC ENGINEERING")
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
        int count = Math.clamp(limit, 20, 30000);
        List<Candle> candles = null;
        if (!"DEMO".equals(safeProvider)) {
            candles = brokerCandleService.fetchCandles(safeProvider, symbol, interval, count, to, session);
            if (candles == null) {
                if (!brokerCandleService.isConnected(safeProvider, session)) {
                    return ResponseEntity.status(401).body("Not connected to " + safeProvider
                        + ". Click Connect and complete the broker login, or switch to Demo.");
                }
                List<Candle> lastKnown = brokerCandleService.lastKnownCandles(safeProvider, symbol, interval);
                if (lastKnown != null && !lastKnown.isEmpty()) {
                    return ResponseEntity.ok(new CandleResponse(safeProvider, symbol.toUpperCase(Locale.ROOT), interval, lastKnown));
                }
                candles = demoCandles(symbol, interval, count, from, to);
            }
        }
        if (candles == null) {
            candles = demoCandles(symbol, interval, count, from, to);
        }
        if (from != null) {
            candles = candles.stream().filter(candle -> candle.time() >= from * 1000).toList();
        }
        if (to != null) {
            candles = candles.stream().filter(candle -> candle.time() <= to * 1000).toList();
        }
        return ResponseEntity.ok(new CandleResponse(safeProvider, symbol.toUpperCase(Locale.ROOT), interval, candles));
    }

    private List<Candle> demoCandles(String symbol, String interval, int count, Long from, Long to) {
        if (from != null && to != null) {
            return brokerCandleService.generateDemoRange(symbol, interval, from * 1000, to * 1000, count);
        } else if (to != null) {
            return brokerCandleService.generateDemoTo(symbol, interval, count, to * 1000);
        } else {
            return brokerCandleService.generateDemo(symbol, interval, count);
        }
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
            if (history != null && !history.isEmpty()) return ResponseEntity.ok(history.getLast());
            if (!brokerCandleService.isConnected(safeProvider, session)) {
                return ResponseEntity.status(401).body("Not connected to " + safeProvider + ". Click Connect to log in.");
            }
            List<Candle> lastKnown = brokerCandleService.lastKnownCandles(safeProvider, symbol, interval);
            if (lastKnown != null && !lastKnown.isEmpty()) return ResponseEntity.ok(lastKnown.getLast());
            String detail = "ANGEL_ONE".equals(safeProvider) && brokerCandleService.lastAngelError() != null
                ? brokerCandleService.lastAngelError() : "no data available";
            return ResponseEntity.status(503).body("Broker data unavailable for " + safeProvider
                + " (" + detail + "). Reconnect the broker or switch to Demo.");
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

    @GetMapping("/indices")
    public ResponseEntity<?> indices(@RequestParam(defaultValue = "DEMO") String provider, HttpSession session) {
        String safeProvider = provider.toUpperCase(Locale.ROOT);
        if (!PROVIDERS.contains(safeProvider)) return ResponseEntity.badRequest().body("Unknown provider");
        List<IndexQuote> quotes = new java.util.ArrayList<>();
        String[][] defs = {
            {"NSE:NIFTY 50", "NIFTY 50"},
            {"NSE:NIFTY BANK", "BANK NIFTY"},
            {"BSE:SENSEX", "SENSEX"},
        };
        for (String[] d : defs) {
            String symbol = d[0];
            if ("DEMO".equals(safeProvider)) {
                List<Candle> h = brokerCandleService.generateDemo(symbol, "1d", 3);
                if (h != null && !h.isEmpty()) {
                    Candle last = h.getLast();
                    double prev = h.size() > 1 ? h.get(h.size() - 2).close() : last.open();
                    quotes.add(new IndexQuote(symbol, d[1], last.close(), prev > 0 ? (last.close() - prev) / prev * 100 : 0, "DEMO"));
                } else {
                    quotes.add(new IndexQuote(symbol, d[1], null, null, "UNAVAILABLE"));
                }
                continue;
            }
            if (!brokerCandleService.isConnected(safeProvider, session)) {
                quotes.add(new IndexQuote(symbol, d[1], null, null, "NOT_CONNECTED"));
                continue;
            }
            Candle live = brokerCandleService.fetchLiveQuote(safeProvider, symbol, "1d", 2, session);
            if (live == null) {
                List<Candle> history = brokerCandleService.fetchCandles(safeProvider, symbol, "1d", 2, session);
                if (history != null && !history.isEmpty()) {
                    Candle last = history.getLast();
                    double prev = history.size() > 1 ? history.get(history.size() - 2).close() : last.open();
                    quotes.add(new IndexQuote(symbol, d[1], last.close(), prev > 0 ? (last.close() - prev) / prev * 100 : 0, "HISTORY"));
                } else {
                    quotes.add(new IndexQuote(symbol, d[1], null, null, "UNAVAILABLE"));
                }
                continue;
            }
            double prev = live.open();
            List<Candle> history = brokerCandleService.fetchCandles(safeProvider, symbol, "1d", 2, session);
            if (history != null && history.size() > 1) prev = history.get(history.size() - 2).close();
            double cur = live.close();
            quotes.add(new IndexQuote(symbol, d[1], cur, prev > 0 ? (cur - prev) / prev * 100 : 0, "LIVE"));
        }
        return ResponseEntity.ok(java.util.Map.of("provider", safeProvider, "indices", quotes));
    }

    public record IndexQuote(String symbol, String label, Double value, Double changePct, String source) {}

    public record Provider(String id, String name, String status) {}
    public record SymbolInfo(String value, String label) {}
    public record SymbolGroup(String category, List<SymbolInfo> symbols) {}
    public record Candle(long time, double open, double high, double low, double close, long volume) {}
    public record CandleResponse(String provider, String symbol, String interval, List<Candle> candles) {}
}
