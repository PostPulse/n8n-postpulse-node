import type {
	IExecuteFunctions,
	IRequestOptions,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequest } from '../helpers/ApiHelper';

export async function executeMediaOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	if (operation === 'upload') {
		return await uploadMedia.call(this, itemIndex);
	}
	
	throw new NodeOperationError(this.getNode(), `Unknown media operation: ${operation}`, { itemIndex });
}

async function uploadMedia(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;

	const item = this.getInputData()[itemIndex];

	if (!item.binary || !item.binary[binaryPropertyName]) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found for property "${binaryPropertyName}"`,
			{
				itemIndex,
			},
		);
	}

	const binaryData = item.binary[binaryPropertyName];
	const filename = binaryData.fileName || 'file';
	const contentType = binaryData.mimeType || 'application/octet-stream';
	
	// Get binary data buffer
	const binaryBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const sizeBytes = binaryBuffer.length;

	// Step 1: Get presigned upload URL
	const uploadRequest = {
		filename,
		contentType,
		sizeBytes,
	};

	const presignedResponse = await makeApiRequest.call(this, 'POST', '/v1/media/upload/urls', uploadRequest);
	
	if (!presignedResponse || !presignedResponse.url || !presignedResponse.key) {
		throw new NodeOperationError(
			this.getNode(),
			'Failed to get presigned upload URL from PostPulse API',
			{ itemIndex },
		);
	}

	// Step 2: Upload file to presigned URL
	const uploadOptions: IRequestOptions = {
		method: presignedResponse.method || 'PUT',
		url: presignedResponse.url,
		body: binaryBuffer,
		headers: {
			...presignedResponse.headers,
			'Content-Type': contentType,
		},
	};

	try {
		await this.helpers.request(uploadOptions);
	} catch (error: any) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to upload file to presigned URL: ${error.message}`,
			{ itemIndex },
		);
	}

	// Return key in backward-compatible format
	return {
		path: presignedResponse.key,
	};
}
