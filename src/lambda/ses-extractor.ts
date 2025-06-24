import { SESEvent, Context } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Message, Document, DocumentTypes } from '../types/ses-mail';

const s3 = new S3Client();
const simpleParser = require('mailparser').simpleParser;
const uuid = require('uuid');

const bucketName: string = process.env.BUCKET_EMAILS || '';
const folderIn: string = process.env.FOLDER_INCOMING || '';;
const folderOut: string = process.env.FOLDER_ATTACHMENTS || '';;

export const handler = async (event: SESEvent, context: Context) => {

  const messageId = event.Records[0].ses.mail.messageId;
  const emlFile = `s3://${bucketName}/${folderIn}/${messageId}`;
  const response = {
    MessageId: messageId,
    FunctionName: context.functionName,
    DocumentCount: 0,
    Documents: Array()
  };
  console.log('SES message ID: ', messageId);

  try {
    console.log('Parsing EML file: ', emlFile);
    let command = new GetObjectCommand({ Bucket: bucketName, Key: `${folderIn}/${messageId}` });
    let data = await s3.send(command);
    let mail = await simpleParser(data.Body);

    let message: Message = {
      MessageId: messageId, 
      EmlFile: emlFile, 
      To: mail.to.text,
      From: mail.from.text, 
      Subject: mail.subject, 
      ReceivedAt: mail.date,
      Sender: {
        Name: mail.from.value[0].name,
        Address: mail.from.value[0].address.toLowerCase(),
      }
    };
    console.log(JSON.stringify(message));

    for (const att of mail.attachments) {

      if (Object.values(DocumentTypes).includes(att.contentType as DocumentTypes)) {
        console.log('Extracting attachment...');

        let params = {
          Bucket: bucketName, 
          Key: `${folderOut}/${messageId}/${att.filename}`,
          Body: att.content,
          ContentType: att.ContentType,
          ContentLength: att.ContentSize
        };
        let command = new PutObjectCommand(params);
        let target = await s3.send(command);
        
        let document: Document = {
          DocumentId: uuid.v5(target.ETag, uuid.v5.DNS),
          CreatedAt: new Date().toISOString(),
          FileName: att.filename, 
          ContentType: att.contentType, 
          Size: att.size,
          Location: `s3://${bucketName}/${folderOut}/${messageId}/${att.filename}`,
        };
        console.log(JSON.stringify(document));
        
        response.Documents.push({ ...message, ...document });
      } 

      else {
        console.log('No attachment files found.');
      }

    }
  }

  catch (error: any) {
    console.error(error.message, error.stack);
    throw new Error(error);
  }

  finally {
    response.DocumentCount = response.Documents.length;
    console.log('Message processing done.');
    return response;
  }

};