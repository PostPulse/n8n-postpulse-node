import type {
	IExecuteFunctions,
	IDataObject,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequestWithFormData } from '../helpers/ApiHelper';

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
	const formData: IDataObject = {};

	formData.file = {
		value: this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName),
		options: {
			filename: binaryData.fileName || 'file',
			contentType: binaryData.mimeType,
		},
	};

	return await makeApiRequestWithFormData.call(this, 'POST', '/v1/media/upload', formData, itemIndex);
}
