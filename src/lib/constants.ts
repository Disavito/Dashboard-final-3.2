export const COMPANY_ID = 1;
export const BRANCH_ID = 1;

export const DEFAULT_SERIE_BOLETA = 'B001';
export const DEFAULT_MONEDA = 'PEN';
export const DEFAULT_TIPO_OPERACION = '01'; // Venta Interna
export const DEFAULT_FORMA_PAGO = 'Contado';
export const DEFAULT_ITEM_CODE = 'SERV001';
export const DEFAULT_SUNAT_PRODUCT_CODE = '00001'; // UPDATED: Changed from '50121500' to '00001'

export const DEFAULT_SERIE_NOTA_CREDITO_BOLETA = 'BC01'; // Nueva constante
export const DEFAULT_SERIE_NOTA_CREDITO_FACTURA = 'FC01'; // Nueva constante

export const TIPO_DOCUMENTO_CLIENTE = [
  { code: '1', name: 'DNI' },
  { code: '6', name: 'RUC' },
  { code: '0', name: 'OTROS' },
];

export const TIPO_AFECTACION_IGV = [
  { code: '10', name: 'Gravado - Operación Onerosa' },
  { code: '20', name: 'Exonerado - Operación Onerosa' },
  { code: '30', name: 'Inafecto - Operación Onerosa' },
  { code: '40', name: 'Exportación' },
];

export const CREDIT_NOTE_REASONS = [
  { code: '01', name: 'Anulación de la operación' },
  { code: '02', name: 'Anulación por error en el RUC' },
  { code: '03', name: 'Corrección por error en la descripción' },
  { code: '04', name: 'Descuento global' },
  { code: '05', name: 'Descuento por ítem' },
  { code: '06', name: 'Devolución total' },
  { code: '07', name: 'Devolución por ítem' },
  { code: '08', name: 'Bonificación' },
  { code: '09', name: 'Disminución en el valor' },
  { code: '10', name: 'Otros' },
];
