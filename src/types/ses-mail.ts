export interface Message {
  MessageId: string;
  EmlFile: string;
  To: string;
  From: string;
  Subject: string;
  ReceivedAt: string;
  Sender: {
    Name: string;
    Address: string;
  };
}

export interface Document {
  DocumentId: string;
  CreatedAt: string;
  FileName: string;
  ContentType: string;
  Size: number;
  Location: string;
}

export enum DocumentTypes {
  PDF = 'application/pdf',
  MSWORD = 'application/msword',
  EXCEL = 'application/vnd.ms-excel',
  POWERPOINT = 'application/vnd.ms-powerpoint',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  RTF = 'application/rtf',
  PLAIN = 'text/plain',
  CSV = 'text/csv',
  RTF_TEXT = 'text/rtf',
}
