declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: WorkSheet };
  }

  export interface WorkSheet {
    [cell: string]: CellObject | any;
  }

  export interface CellObject {
    v?: string | number | boolean | Date;
    t?: string;
    w?: string;
  }

  export function read(data: any, opts?: any): WorkBook;
  export function writeFile(book: WorkBook, filename: string, opts?: any): void;

  export namespace utils {
    function sheet_to_json(worksheet: WorkSheet, opts?: any): any[];
    function aoa_to_sheet(data: any[][], opts?: any): WorkSheet;
    function book_new(): WorkBook;
    function book_append_sheet(book: WorkBook, sheet: WorkSheet, name?: string): void;
  }

  const XLSX: {
    read: (data: any, opts?: any) => WorkBook;
    writeFile: (book: WorkBook, filename: string, opts?: any) => void;
    utils: {
      sheet_to_json: (worksheet: WorkSheet, opts?: any) => any[];
      aoa_to_sheet: (data: any[][], opts?: any) => WorkSheet;
      book_new: () => WorkBook;
      book_append_sheet: (book: WorkBook, sheet: WorkSheet, name?: string) => void;
    };
  };

  export default XLSX;
}
