declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: WorkSheet };
  }

  export interface WorkSheet {
    [cell: string]: CellObject;
  }

  export interface CellObject {
    v?: string | number | boolean | Date;
    t?: string;
    w?: string;
  }

  export function read(data: any, opts?: any): WorkBook;
  
  export namespace utils {
    function sheet_to_json(worksheet: WorkSheet, opts?: any): any[];
  }

  const XLSX: {
    read: (data: any, opts?: any) => WorkBook;
    utils: {
      sheet_to_json: (worksheet: WorkSheet, opts?: any) => any[];
    };
  };

  export default XLSX;
}

