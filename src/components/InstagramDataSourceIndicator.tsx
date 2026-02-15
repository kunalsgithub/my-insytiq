import React from 'react';

const InstagramDataSourceIndicator = ({ dataSource }: { dataSource: string }) => (
  <div className="mb-4">
    <span className="inline-block px-3 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-600">
      Data Source: {dataSource}
    </span>
  </div>
);

export default InstagramDataSourceIndicator; 