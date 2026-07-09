import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Body vazio.' }) };
    }

    const { contentType } = JSON.parse(event.body);

    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Tipo de arquivo não permitido. Apenas JPG, PNG e WEBP.' }) };
    }

    const bucketName = process.env.BUCKET_NAME;
    // Gera um nome único para o arquivo para evitar colisões no S3
    const extension = contentType.split('/')[1];
    const fileName = `${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadUrl,
        mediaUrl: `https://${bucketName}.s3.amazonaws.com/${fileName}`,
      }),
    };

  } catch (error) {
    console.error('Erro ao gerar url assinada:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor.' }) };
  }
};