import { deflateRawSync, crc32 } from 'node:zlib';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelSheetOptions {
  sheetName?: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, any>>;
}

export interface ExportableUserRow {
  id: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  country: string | null;
  accountStatus: string;
  verificationStatus: string;
  createdAt: Date | string;
  nationalId?: string | null;
}

/**
 * Escapes characters for XML text nodes and attribute values.
 */
function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts a 0-indexed column number (0=A, 1=B, 25=Z, 26=AA) into an Excel column letter.
 */
function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Builds a zip archive buffer conforming strictly to standard ZIP specifications.
 */
function buildZipArchive(files: Array<{ name: string; data: string | Buffer }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name, 'utf8');
    const dataBuf = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const compressed = deflateRawSync(dataBuf);
    const checksum = crc32(dataBuf);

    // Local file header (30 bytes + name)
    const lh = Buffer.alloc(30 + filenameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4); // Minimum version (2.0)
    lh.writeUInt16LE(0, 6); // General purpose bit flag
    lh.writeUInt16LE(8, 8); // Compression method (DEFLATE)
    lh.writeUInt16LE(0, 10); // File mod time
    lh.writeUInt16LE(0, 12); // File mod date
    lh.writeUInt32LE(checksum, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(filenameBuf.length, 26);
    lh.writeUInt16LE(0, 28); // Extra field length
    filenameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central directory file header (46 bytes + name)
    const cd = Buffer.alloc(46 + filenameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // Central dir signature
    cd.writeUInt16LE(20, 4); // Version made by
    cd.writeUInt16LE(20, 6); // Version needed to extract
    cd.writeUInt16LE(0, 8); // Flags
    cd.writeUInt16LE(8, 10); // Compression method (DEFLATE)
    cd.writeUInt16LE(0, 12); // Mod time
    cd.writeUInt16LE(0, 14); // Mod date
    cd.writeUInt32LE(checksum, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(dataBuf.length, 24);
    cd.writeUInt16LE(filenameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // Extra field length
    cd.writeUInt16LE(0, 32); // File comment length
    cd.writeUInt16LE(0, 34); // Disk number start
    cd.writeUInt16LE(0, 36); // Internal file attributes
    cd.writeUInt32LE(0, 38); // External file attributes
    cd.writeUInt32LE(offset, 42); // Relative offset of local header
    filenameBuf.copy(cd, 46);

    centralDirs.push(cd);
    offset += lh.length + compressed.length;
  }

  const centralDirSize = centralDirs.reduce((acc, c) => acc + c.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central dir signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // Number of central dir records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total number of central dir records
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralDirs, eocd]);
}

/**
 * Generates an OpenXML (.xlsx) binary workbook buffer containing styled customer data.
 */
export function generateExcelWorkbook(options: ExcelSheetOptions): Buffer {
  const { sheetName = 'Users', columns, rows } = options;

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 3. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 4. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/>
  </bookViews>
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // 5. xl/styles.xml (Professional typography & header styling)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="10"/>
      <color rgb="FF1E293B"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Segoe UI"/>
    </font>
  </fonts>
  <fills count="3">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF0F766E"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <!-- 0: default regular text -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <!-- 1: header row style (teal/emerald background, bold white text) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: centered regular cell -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // 6. xl/worksheets/sheet1.xml
  const colElements = columns
    .map((col, idx) => {
      const w = col.width || Math.max(14, col.header.length + 5);
      return `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`;
    })
    .join('');

  // Row 1: Header
  const headerCells = columns
    .map((col, idx) => {
      const cellRef = `${getColumnLetter(idx)}1`;
      return `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(col.header)}</t></is></c>`;
    })
    .join('');
  const headerRow = `<row r="1" ht="26" customHeight="1">${headerCells}</row>`;

  // Data Rows
  const dataRowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 2;
      const cells = columns
        .map((col, cIdx) => {
          const cellRef = `${getColumnLetter(cIdx)}${rowNum}`;
          const val = row[col.key];
          const formatted = val instanceof Date ? val.toISOString().replace('T', ' ').slice(0, 19) : val ?? '';
          return `<c r="${cellRef}" s="0" t="inlineStr"><is><t>${escapeXml(formatted)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}" ht="20" customHeight="1">${cells}</row>`;
    })
    .join('');

  const totalRows = rows.length + 1;
  const lastColLetter = getColumnLetter(columns.length - 1);
  const dimensionRef = `A1:${lastColLetter}${totalRows}`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colElements}</cols>
  <sheetData>
    ${headerRow}
    ${dataRowsXml}
  </sheetData>
</worksheet>`;

  return buildZipArchive([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/styles.xml', data: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
  ]);
}

/**
 * Standard Customer Directory Excel (.xlsx) generator matching Task 2.4 specifications:
 * Columns:
 * 1. Full Name
 * 2. Email Address
 * 3. Country
 * 4. Customer Account ID
 * 5. Account Status
 * 6. Verification Status
 * 7. Registration Date
 * (Optional 8: National ID Number for authorized staff)
 */
export function exportUsersToExcelBuffer(
  users: ExportableUserRow[],
  options?: { includeNationalId?: boolean }
): Buffer {
  const includeId = Boolean(options?.includeNationalId);

  const columns: ExcelColumn[] = [
    { header: 'Full Name', key: 'fullName', width: 26 },
    { header: 'Email Address', key: 'email', width: 28 },
    { header: 'Country', key: 'country', width: 16 },
    { header: 'Customer Account ID', key: 'id', width: 30 },
    { header: 'Account Status', key: 'accountStatus', width: 16 },
    { header: 'Verification Status', key: 'verificationStatus', width: 20 },
    { header: 'Registration Date', key: 'createdAt', width: 22 },
  ];

  if (includeId) {
    columns.push({ header: 'National ID Number', key: 'nationalId', width: 24 });
  }

  const rows = users.map((u) => {
    let regDate = '';
    if (u.createdAt) {
      const d = typeof u.createdAt === 'string' ? new Date(u.createdAt) : u.createdAt;
      regDate = !isNaN(d.getTime()) ? d.toISOString().replace('T', ' ').slice(0, 19) : String(u.createdAt);
    }

    const rowObj: Record<string, any> = {
      fullName: u.fullName || 'N/A',
      email: u.email || 'N/A',
      country: u.country || 'Rwanda',
      id: u.id,
      accountStatus: u.accountStatus,
      verificationStatus: u.verificationStatus,
      createdAt: regDate,
    };

    if (includeId) {
      rowObj.nationalId = u.nationalId || 'N/A';
    }

    return rowObj;
  });

  return generateExcelWorkbook({
    sheetName: 'Zenova Customers',
    columns,
    rows,
  });
}
