ALTER TABLE "jurisdictions" ADD COLUMN "status_source_ids" jsonb;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD COLUMN "status_reviewed_at" date;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD COLUMN "status_note" text;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD COLUMN "administering_jurisdiction_iso3" text;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD COLUMN "status_disputed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

UPDATE "jurisdictions"
SET
  "type" = CASE
    WHEN "iso3" IN ('AFG','AGO','ALB','AND','ARE','ARG','ARM','ATG','AUS','AUT','AZE','BDI','BEL','BEN','BFA','BGD','BGR','BHR','BHS','BIH','BLR','BLZ','BOL','BRA','BRB','BRN','BTN','BWA','CAF','CAN','CHE','CHL','CHN','CIV','CMR','COD','COG','COL','COM','CPV','CRI','CUB','CYP','CZE','DEU','DJI','DMA','DNK','DOM','DZA','ECU','EGY','ERI','ESP','EST','ETH','FIN','FJI','FRA','FSM','GAB','GBR','GEO','GHA','GIN','GMB','GNB','GNQ','GRC','GRD','GTM','GUY','HND','HRV','HTI','HUN','IDN','IND','IRL','IRN','IRQ','ISL','ISR','ITA','JAM','JOR','JPN','KAZ','KEN','KGZ','KHM','KIR','KNA','KOR','KWT','LAO','LBN','LBR','LBY','LCA','LIE','LKA','LSO','LTU','LUX','LVA','MAR','MCO','MDA','MDG','MDV','MEX','MHL','MKD','MLI','MLT','MMR','MNE','MNG','MOZ','MRT','MUS','MWI','MYS','NAM','NER','NGA','NIC','NLD','NOR','NPL','NRU','NZL','OMN','PAK','PAN','PER','PHL','PLW','PNG','POL','PRK','PRT','PRY','QAT','ROU','RUS','RWA','SAU','SDN','SEN','SGP','SLB','SLE','SLV','SMR','SOM','SRB','SSD','STP','SUR','SVK','SVN','SWE','SWZ','SYC','SYR','TCD','TGO','THA','TJK','TKM','TLS','TON','TTO','TUN','TUR','TUV','TZA','UGA','UKR','URY','USA','UZB','VCT','VEN','VNM','VUT','WSM','YEM','ZAF','ZMB','ZWE','VAT') THEN 'sovereign_state'
    WHEN "iso3" IN ('PSE','TWN','XKS') OR "slug" IN ('gaza-gaza-strip','paracel-islands','spratly-islands','west-bank','western-sahara') THEN 'disputed_or_limited_recognition'
    WHEN "slug" IN ('cook-islands','niue') THEN 'associated_state'
    WHEN "slug" IN ('antarctica','baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll') THEN 'aggregate_or_special_area'
    WHEN "slug" IN ('akrotiri','american-samoa','anguilla','aruba','ashmore-and-cartier-islands','bermuda','bouvet-island','british-virgin-islands','cayman-islands','christmas-island','clipperton-island','cocos-keeling-islands','coral-sea-islands','curacao','dhekelia','falkland-islands-islas-malvinas','faroe-islands','french-polynesia','french-southern-and-antarctic-lands','gibraltar','greenland','guam','guernsey','heard-island-and-mcdonald-islands','hong-kong','isle-of-man','jan-mayen','jersey','macau','montserrat','navassa-island','new-caledonia','norfolk-island','northern-mariana-islands','pitcairn-islands','puerto-rico','saint-barthelemy','saint-martin','saint-pierre-and-miquelon','sint-maarten','south-georgia-and-south-sandwich-islands','svalbard-sometimes-referred-to-as-spitsbergen-the-largest-island-in-the-archipelago','tokelau','turks-and-caicos-islands','virgin-islands','wake-island','wallis-and-futuna') THEN 'dependency_or_territory'
    ELSE '__unclassified__'
  END,
  "status_source_ids" = CASE
    WHEN "iso3" IN ('AFG','AGO','ALB','AND','ARE','ARG','ARM','ATG','AUS','AUT','AZE','BDI','BEL','BEN','BFA','BGD','BGR','BHR','BHS','BIH','BLR','BLZ','BOL','BRA','BRB','BRN','BTN','BWA','CAF','CAN','CHE','CHL','CHN','CIV','CMR','COD','COG','COL','COM','CPV','CRI','CUB','CYP','CZE','DEU','DJI','DMA','DNK','DOM','DZA','ECU','EGY','ERI','ESP','EST','ETH','FIN','FJI','FRA','FSM','GAB','GBR','GEO','GHA','GIN','GMB','GNB','GNQ','GRC','GRD','GTM','GUY','HND','HRV','HTI','HUN','IDN','IND','IRL','IRN','IRQ','ISL','ISR','ITA','JAM','JOR','JPN','KAZ','KEN','KGZ','KHM','KIR','KNA','KOR','KWT','LAO','LBN','LBR','LBY','LCA','LIE','LKA','LSO','LTU','LUX','LVA','MAR','MCO','MDA','MDG','MDV','MEX','MHL','MKD','MLI','MLT','MMR','MNE','MNG','MOZ','MRT','MUS','MWI','MYS','NAM','NER','NGA','NIC','NLD','NOR','NPL','NRU','NZL','OMN','PAK','PAN','PER','PHL','PLW','PNG','POL','PRK','PRT','PRY','QAT','ROU','RUS','RWA','SAU','SDN','SEN','SGP','SLB','SLE','SLV','SMR','SOM','SRB','SSD','STP','SUR','SVK','SVN','SWE','SWZ','SYC','SYR','TCD','TGO','THA','TJK','TKM','TLS','TON','TTO','TUN','TUR','TUV','TZA','UGA','UKR','URY','USA','UZB','VCT','VEN','VNM','VUT','WSM','YEM','ZAF','ZMB','ZWE') THEN '["un_member_states","un_m49"]'::jsonb
    WHEN "iso3" IN ('VAT','PSE') THEN '["un_non_member_states","un_m49","cia_factbook"]'::jsonb
    WHEN "slug" = 'cook-islands' THEN '["nz_mfat_cook_islands","cia_factbook","un_m49"]'::jsonb
    WHEN "slug" = 'niue' THEN '["nz_mfat_niue","cia_factbook","un_m49"]'::jsonb
    ELSE '["cia_factbook","un_m49"]'::jsonb
  END,
  "status_reviewed_at" = DATE '2026-07-10',
  "status_note" = CASE
    WHEN "iso3" IN ('PSE','TWN','XKS') OR "slug" IN ('gaza-gaza-strip','paracel-islands','spratly-islands','west-bank','western-sahara') THEN 'Separately profiled without claiming that Atlas inclusion, ISO/M49 coding, or this label settles recognition or sovereignty.'
    WHEN "slug" IN ('cook-islands','niue') THEN 'Self-governing in free association with New Zealand; not flattened into the sovereign-state or dependency categories.'
    WHEN "slug" = 'antarctica' THEN 'Special treaty area retained as an Atlas reference entry and excluded from sovereign-state counts.'
    WHEN "slug" = 'baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll' THEN 'One Atlas row groups several United States island areas and is excluded from sovereign-state counts.'
    WHEN "iso3" = 'VAT' THEN 'The Holy See is a UN non-member observer state and is separately classified as sovereign; observer or M49 status alone is not a general sovereignty rule.'
    WHEN "iso3" IS NOT NULL THEN 'Listed by Civica as a sovereign state because it is in the closed UN member-state inventory.'
    ELSE 'Separately profiled dependency or territory; the administering relationship is descriptive and does not resolve a competing claim.'
  END,
  "administering_jurisdiction_iso3" = CASE
    WHEN "slug" IN ('ashmore-and-cartier-islands','christmas-island','cocos-keeling-islands','coral-sea-islands','heard-island-and-mcdonald-islands','norfolk-island') THEN 'AUS'
    WHEN "slug" IN ('hong-kong','macau') THEN 'CHN'
    WHEN "slug" IN ('faroe-islands','greenland') THEN 'DNK'
    WHEN "slug" IN ('clipperton-island','french-polynesia','french-southern-and-antarctic-lands','new-caledonia','saint-barthelemy','saint-martin','saint-pierre-and-miquelon','wallis-and-futuna') THEN 'FRA'
    WHEN "slug" IN ('akrotiri','anguilla','bermuda','british-virgin-islands','cayman-islands','dhekelia','falkland-islands-islas-malvinas','gibraltar','guernsey','isle-of-man','jersey','montserrat','pitcairn-islands','south-georgia-and-south-sandwich-islands','turks-and-caicos-islands') THEN 'GBR'
    WHEN "slug" IN ('aruba','curacao','sint-maarten') THEN 'NLD'
    WHEN "slug" IN ('bouvet-island','jan-mayen','svalbard-sometimes-referred-to-as-spitsbergen-the-largest-island-in-the-archipelago') THEN 'NOR'
    WHEN "slug" IN ('cook-islands','niue','tokelau') THEN 'NZL'
    WHEN "slug" IN ('american-samoa','baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll','guam','navassa-island','northern-mariana-islands','puerto-rico','virgin-islands','wake-island') THEN 'USA'
    ELSE NULL
  END,
  "status_disputed" = (
    COALESCE("iso3" IN ('PSE','TWN','XKS'), false) OR
    "slug" IN ('gaza-gaza-strip','paracel-islands','spratly-islands','west-bank','western-sahara','falkland-islands-islas-malvinas','navassa-island','south-georgia-and-south-sandwich-islands')
  );
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "jurisdictions" WHERE "type" = '__unclassified__') THEN
    RAISE EXCEPTION 'jurisdiction-status/v1 does not classify every jurisdiction';
  END IF;
  IF (SELECT COUNT(*) FROM "jurisdictions") <> 253 THEN
    RAISE EXCEPTION 'jurisdiction-status/v1 expected the frozen 253-row catalog';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "jurisdictions" ALTER COLUMN "status_source_ids" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ALTER COLUMN "status_reviewed_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ALTER COLUMN "status_note" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_status_type_check" CHECK ("type" IN ('sovereign_state','associated_state','dependency_or_territory','disputed_or_limited_recognition','aggregate_or_special_area'));
