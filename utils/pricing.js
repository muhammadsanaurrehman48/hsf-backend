// Centralized pricing configuration for ASF Medical Complex
// Rates = ASF Staff / ASF Family / ASF School
// PVT = Civilian (Private Patient)

export const LAB_TEST_PRICES = {
  'CPC & ESR':         { asf: 250, pvt: 450 },
  'MPICT':             { asf: 250, pvt: 500 },
  'Hb %':              { asf: 200, pvt: 300 },
  'H.C.V & Hbs Ag':   { asf: 350, pvt: 600 },
  'Urine D/R':         { asf: 120, pvt: 250 },
  'Pregnancy Test':    { asf: 120, pvt: 200 },
  'Stool DR':          { asf: 100, pvt: 250 },
  'FBS':               { asf: 120, pvt: 250 },
  'RBS':               { asf: 120, pvt: 250 },
  "LFT's":             { asf: 400, pvt: 650 },
  'SGPT':              { asf: 150, pvt: 250 },
  'Dengue':            { asf: 450, pvt: 750 },
  'H Pylori (Stool)':  { asf: 350, pvt: 500 },
  'H Pylori (Blood)':  { asf: 350, pvt: 500 },
  'Lipid Profile':     { asf: 400, pvt: 650 },
  'Cholesterol':       { asf: 150, pvt: 300 },
  'Uric Acid':         { asf: 150, pvt: 300 },
  'Blood Grouping':    { asf: 120, pvt: 250 },
  'ALK Phos':          { asf: 150, pvt: 250 },
  'T.G':               { asf: 150, pvt: 250 },
  'HDL':               { asf: 200, pvt: 320 },
  'Urea':              { asf: 150, pvt: 250 },
  'Creatinine':        { asf: 150, pvt: 250 },
  'Platelets':         { asf: 200, pvt: 400 },
  'HIV':               { asf: 300, pvt: 700 },
  'MP':                { asf: 100, pvt: 200 },
};

export const RADIOLOGY_TEST_PRICES = {
  'Chest PA':                   { asf: 250, pvt: 350 },
  'L/Spine AP Lateral':         { asf: 250, pvt: 600 },
  'Knee Joint Lateral':         { asf: 250, pvt: 300 },
  'Cervical Spine AP Lateral':  { asf: 250, pvt: 600 },
};

export const OPD_CHARGES = {
  'ASF':        0,     // Free for ASF Staff
  'ASF_FAMILY': 30,    // Rs. 30 for ASF Family
  'ASF_SCHOOL': 30,    // Rs. 30 for ASF School / ASFF
  'CIVILIAN':   100,   // Rs. 100 for Private / Civilian
};

/**
 * Get the price for a lab test based on patient type
 * @param {string} testName - Name of the lab test
 * @param {string} patientType - ASF, ASF_FAMILY, ASF_SCHOOL, or CIVILIAN
 * @returns {number} price
 */
export function getLabTestPrice(testName, patientType) {
  const pricing = LAB_TEST_PRICES[testName];
  if (!pricing) return 0;
  return patientType === 'CIVILIAN' ? pricing.pvt : pricing.asf;
}

/**
 * Get the price for a radiology test based on patient type
 * @param {string} testName - Name of the radiology test
 * @param {string} patientType - ASF, ASF_FAMILY, ASF_SCHOOL, or CIVILIAN
 * @returns {number} price
 */
export function getRadiologyTestPrice(testName, patientType) {
  const pricing = RADIOLOGY_TEST_PRICES[testName];
  if (!pricing) return 0;
  return patientType === 'CIVILIAN' ? pricing.pvt : pricing.asf;
}

/**
 * Get OPD charge based on patient type
 * @param {string} patientType - ASF, ASF_FAMILY, ASF_SCHOOL, or CIVILIAN
 * @returns {number} charge
 */
export function getOPDCharge(patientType) {
  return OPD_CHARGES[patientType] ?? 100;
}

/**
 * Determine if medicines are free for this patient type
 * @param {string} patientType 
 * @returns {boolean}
 */
export function isMedicineFree(patientType) {
  return patientType === 'ASF' || patientType === 'ASF_FAMILY' || patientType === 'ASF_SCHOOL';
}
