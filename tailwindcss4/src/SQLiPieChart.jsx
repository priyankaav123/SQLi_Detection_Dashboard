import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useWebSocket } from "./context/WebSocketContext"; // Import the WebSocket context hook

const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28BFF", 
  "#FF6B6B", "#54C5EB", "#ACD964", "#FFD166", "#F472B6"
];

const SQLI_PATTERNS = {
  "Union-Based SQLi": /union\s+select|union\s*all\s*select|union\+\s*select/i,
  "Error-Based SQLi": /error\s+in\s+your\s+sql|updatexml|extractvalue|mysql_error|pg_error|ORA-|database\s+error/i,
  "Boolean-Based SQLi": /or\s+.*=\s+.*|and\s+.*=\s+.*|or\s+\d+=\d+|or\s+'.+'='.+|and\s+'.+'='.+/i,
  "Time-Based SQLi": /sleep\(\d+\)|benchmark\(\d+,|pg_sleep\(\d+\)|waitfor\s+delay\s+'00:00:\d+'/i,
  "Out-of-Band SQLi": /load_file|outfile|into\s+dumpfile|xp_cmdshell|openrowset|bulk\s+insert|fetchurl/i,
  "Obfuscated SQLi": /\bselect\s*\/\*\*\/\s*\bfrom\b|\bunion\s*\/\*\*\/\s*select\b|concat\(.*char\(\d+\)\)/i,
  "Blind SQLi": /\bexists\s*\(|\bnot exists\s*\(|case\s+when\s+|if\s*\(.+\)/i,
  "Stacked Queries": /;.*select|;.*insert|;.*update|;.*delete|;.*drop/i,
  "Hex/Unicode SQLi": /0x[0-9A-F]+|unhex\(|char\(\d+\)|ascii\(\w+\)/i,
  "Comment-Based SQLi": /--\s|\#.*\n|\;\s*--/i,
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-3 rounded-md shadow-lg border border-gray-700">
        <p className="font-bold">{payload[0].name}</p>
        <p className="text-sm">
          Count: <span className="font-semibold">{payload[0].value}</span>
        </p>
        <p className="text-sm">
          Percentage: <span className="font-semibold">
            {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const SQLiPieChart = () => {
  // Get logs directly from the WebSocket context instead of props
  const { logs } = useWebSocket();
  
  const [sqlData, setSqlData] = useState([
    { name: "Union-Based SQLi", value: 0 },
    { name: "Error-Based SQLi", value: 0 },
    { name: "Boolean-Based SQLi", value: 0 },
    { name: "Time-Based SQLi", value: 0 },
    { name: "Blind SQLi", value: 0 },
    { name: "Out-of-Band SQLi", value: 0 },
    { name: "Obfuscated SQLi", value: 0 },
    { name: "Stacked Queries", value: 0 },
    { name: "Hex/Unicode SQLi", value: 0 },
    { name: "Comment-Based SQLi", value: 0 },
    { name: "Other SQLi", value: 0 }
  ]);

  // Process logs and update data
  useEffect(() => {
    if (!logs || logs.length === 0) return;

    // Initialize counters
    const newCounts = Object.fromEntries(sqlData.map(item => [item.name, 0]));
    let total = 0;

    // Process each log
    logs.forEach(log => {
      // Handling both string logs and object logs from the context
      const logString = typeof log === 'string' 
        ? log 
        : log.remarks || ""; // Use the remarks field from parsed logs
      
      const isSQLi = (typeof logString === 'string' && logString.includes("SQL Injection detected!")) || 
                    (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("sqli attempt"));
                    
      if (isSQLi) {
        let matched = false;
        
        // Check against each pattern
        for (const [type, pattern] of Object.entries(SQLI_PATTERNS)) {
          if (typeof logString === 'string' && pattern.test(logString)) {
            newCounts[type]++;
            matched = true;
            total++;
            break;
          }
        }
        
        // If no specific pattern matched
        if (!matched) {
          newCounts["Other SQLi"]++;
          total++;
        }
      }
    });

    // Transform counts to array format for chart
    const newData = Object.entries(newCounts)
      .map(([name, value]) => ({ name, value, total }))
      .filter(item => item.value > 0); // Only include non-zero values
    
    setSqlData(newData);
  }, [logs]);

  // Custom rendering of labels
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.1;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is significant
    return percent > 0.05 ? (
      <text 
        x={x} 
        y={y} 
        fill="#FFF"
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  // If no data, show loading or empty state
  if (sqlData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-gray-400">No SQLi attacks detected yet</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={sqlData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
            animationDuration={800}
            animationBegin={100}
          >
            {sqlData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
                stroke="rgba(0, 0, 0, 0.3)"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{
              fontSize: '12px',
              color: '#FFF'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SQLiPieChart;