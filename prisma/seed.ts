/**
 * Seed de demonstração do JurisPI AI.
 * Execução: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { hashedBagOfWordsEmbedding } from "../src/lib/ai/ai-provider";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("🌱 Iniciando seed do JurisPI AI…");

  // Limpa dados anteriores (ordem respeita as FKs).
  await prisma.aiCitation.deleteMany();
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.generatedDocument.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.deadline.deleteMany();
  await prisma.auditLog.deleteMany();
  // Dados globais do INPI (InpiTrademark, RpiIssue etc.) NÃO são apagados:
  // pertencem à plataforma, não à organização. MonitoredProcess cai em
  // cascata com a organização.
  await prisma.trademarkCase.deleteMany();
  await prisma.patentCase.deleteMany();
  await prisma.industrialDesignCase.deleteMany();
  await prisma.softwareRegistrationCase.deleteMany();
  await prisma.industrialPropertyCase.deleteMany();
  await prisma.client.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 1. Organização
  const org = await prisma.organization.create({
    data: { name: "Escritório Demo PI", slug: "escritorio-demo-pi" },
  });

  // 2. Usuários
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const ana = await prisma.user.create({
    data: { name: "Ana Martins", email: "ana@demopi.com.br", passwordHash },
  });
  const bruno = await prisma.user.create({
    data: { name: "Bruno Costa", email: "bruno@demopi.com.br", passwordHash },
  });
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: org.id, userId: ana.id, role: "ADMIN" },
      { organizationId: org.id, userId: bruno.id, role: "MEMBER" },
    ],
  });

  // 3. Clientes
  const [cafeSerrano, techNova, bellaModa] = await Promise.all([
    prisma.client.create({
      data: {
        organizationId: org.id,
        name: "Café Serrano Ltda.",
        documentNumber: "12.345.678/0001-90",
        email: "contato@cafeserrano.com.br",
        phone: "(31) 3333-1111",
        notes: "Torrefação de café especial em Minas Gerais. Interesse em expandir a marca para a linha de cápsulas.",
      },
    }),
    prisma.client.create({
      data: {
        organizationId: org.id,
        name: "TechNova Sistemas S.A.",
        documentNumber: "98.765.432/0001-10",
        email: "juridico@technova.com.br",
        phone: "(11) 4444-2222",
        notes: "Empresa de tecnologia agrícola. Carteira com patentes de IoT para irrigação.",
      },
    }),
    prisma.client.create({
      data: {
        organizationId: org.id,
        name: "Bella Moda Confecções ME",
        documentNumber: "45.678.912/0001-33",
        email: "bella@bellamoda.com.br",
        phone: "(21) 5555-3333",
        notes: "Confecção de vestuário feminino. Primeira experiência com registro de marca.",
      },
    }),
  ]);

  // 4. Processos de marca (3)
  const marcaSerrano = await prisma.industrialPropertyCase.create({
    data: {
      organizationId: org.id,
      clientId: cafeSerrano.id,
      type: "TRADEMARK",
      title: "Marca — Café Serrano",
      processNumber: "912345678",
      status: "AGUARDANDO_EXAME",
      riskLevel: "MEDIUM",
      summary:
        "Pedido de registro da marca mista CAFÉ SERRANO na classe 30. Publicado na RPI, aguardando exame de mérito.",
      nextStep: "Acompanhar publicações na RPI e eventual oposição de terceiros.",
      trademark: {
        create: {
          brandName: "Café Serrano",
          niceClasses: ["30"],
          presentationType: "Mista",
          nature: "Produto",
          holderName: "Café Serrano Ltda.",
          applicationDate: new Date("2025-09-15"),
          currentStatus: "Aguardando exame de mérito",
          collisionRisk: "MEDIUM",
        },
      },
    },
    include: { trademark: true },
  });

  const marcaTechNova = await prisma.industrialPropertyCase.create({
    data: {
      organizationId: org.id,
      clientId: techNova.id,
      type: "TRADEMARK",
      title: "Marca — AgroSense",
      processNumber: "913456789",
      status: "DEFERIDO",
      riskLevel: "LOW",
      summary:
        "Marca nominativa AGROSENSE deferida nas classes 09 e 42. Aguardando pagamento da concessão.",
      nextStep: "Pagar a taxa de concessão dentro do prazo ordinário.",
      trademark: {
        create: {
          brandName: "AgroSense",
          niceClasses: ["09", "42"],
          presentationType: "Nominativa",
          nature: "Produto e serviço",
          holderName: "TechNova Sistemas S.A.",
          applicationDate: new Date("2024-11-03"),
          currentStatus: "Deferido — aguardando concessão",
          collisionRisk: "LOW",
        },
      },
    },
    include: { trademark: true },
  });

  const marcaBella = await prisma.industrialPropertyCase.create({
    data: {
      organizationId: org.id,
      clientId: bellaModa.id,
      type: "TRADEMARK",
      title: "Marca — Bella Moda",
      status: "EM_ANALISE_PREVIA",
      riskLevel: "HIGH",
      summary:
        "Análise de viabilidade para registro da marca BELLA MODA na classe 25. Busca preliminar apontou marcas semelhantes.",
      nextStep: "Concluir parecer de viabilidade e avaliar ajustes no conjunto marcário.",
      trademark: {
        create: {
          brandName: "Bella Moda",
          niceClasses: ["25"],
          presentationType: "Mista",
          nature: "Produto",
          holderName: "Bella Moda Confecções ME",
          currentStatus: "Análise prévia de viabilidade",
          collisionRisk: "HIGH",
        },
      },
    },
    include: { trademark: true },
  });

  // 5. Processos de patente (2)
  const patenteIrrigacao = await prisma.industrialPropertyCase.create({
    data: {
      organizationId: org.id,
      clientId: techNova.id,
      type: "PATENT",
      title: "Patente — Sistema de irrigação inteligente com sensores IoT",
      processNumber: "BR102024001234",
      status: "AGUARDANDO_EXAME_TECNICO",
      riskLevel: "MEDIUM",
      summary:
        "Pedido de patente de invenção para sistema de irrigação com sensores de umidade e controle preditivo. Exame técnico requerido.",
      nextStep: "Acompanhar a fila de exame técnico do INPI e preparar resposta a eventuais exigências.",
      patent: {
        create: {
          title: "Sistema de irrigação inteligente com sensores IoT e controle preditivo",
          abstract:
            "A presente invenção refere-se a um sistema de irrigação automatizado que integra sensores de umidade do solo, estação meteorológica local e algoritmo preditivo para otimizar o consumo de água em cultivos agrícolas.",
          ipcClasses: ["A01G 25/16", "G05B 19/042"],
          inventors: ["Carlos Andrade", "Mariana Lopes"],
          applicants: ["TechNova Sistemas S.A."],
          filingDate: new Date("2024-06-20"),
          publicationDate: new Date("2025-12-22"),
          currentStatus: "Aguardando exame técnico",
        },
      },
    },
    include: { patent: true },
  });

  const patenteEmbalagem = await prisma.industrialPropertyCase.create({
    data: {
      organizationId: org.id,
      clientId: cafeSerrano.id,
      type: "PATENT",
      title: "Patente — Embalagem com válvula de frescor para café",
      processNumber: "BR202025005678",
      status: "DEPOSITADO",
      riskLevel: "UNKNOWN",
      summary:
        "Modelo de utilidade para embalagem de café com válvula unidirecional de frescor e sistema de refechamento.",
      nextStep: "Requerer o exame técnico e monitorar publicação na RPI.",
      patent: {
        create: {
          title: "Disposição construtiva em embalagem para café com válvula de frescor",
          abstract:
            "Modelo de utilidade que compreende embalagem flexível para café torrado com válvula unidirecional de desgaseificação e mecanismo de refechamento hermético, prolongando o frescor do produto.",
          ipcClasses: ["B65D 33/01", "B65D 81/26"],
          inventors: ["José Serrano"],
          applicants: ["Café Serrano Ltda."],
          filingDate: new Date("2026-02-10"),
          currentStatus: "Depositado — aguardando publicação",
        },
      },
    },
    include: { patent: true },
  });

  // 6. Documentos fictícios (5) + 7. chunks com embeddings
  const documentsData = [
    {
      clientId: cafeSerrano.id,
      caseId: marcaSerrano.id,
      title: "Despacho INPI — Publicação do pedido Café Serrano",
      fileName: "despacho-publicacao-cafe-serrano.txt",
      sourceType: "INPI_OPEN_DATA" as const,
      chunks: [
        "Despacho: Publicação de pedido de registro de marca. Processo nº 912345678. Marca: CAFÉ SERRANO (mista). Classe Nice 30 — café, café em grão, café moído e bebidas à base de café. Titular: Café Serrano Ltda. O pedido encontra-se publicado para apresentação de oposição no prazo legal de 60 (sessenta) dias contados da publicação na RPI.",
        "Nos termos da Lei nº 9.279/96 (Lei da Propriedade Industrial), eventuais oposições deverão ser protocoladas dentro do prazo legal. Após o decurso do prazo de oposição, o pedido seguirá para exame de mérito, no qual serão analisados os requisitos de registrabilidade, incluindo disponibilidade, distintividade e veracidade.",
      ],
    },
    {
      clientId: bellaModa.id,
      caseId: marcaBella.id,
      title: "Busca de anterioridade — Bella Moda classe 25",
      fileName: "busca-anterioridade-bella-moda.txt",
      sourceType: "INTERNAL" as const,
      chunks: [
        "Relatório de busca de anterioridade para a marca BELLA MODA na classe Nice 25 (vestuário). Foram identificados registros semelhantes: BELA MODA FASHION (registro concedido, classe 25, vigente) e BELLAMODAS (pedido em exame, classe 25). A semelhança gráfica e fonética com registros anteriores indica risco elevado de colidência e possível indeferimento.",
        "Recomendações: avaliar a adoção de elemento distintivo adicional no conjunto marcário, considerar apresentação mista com elemento figurativo forte, ou reposicionar o sinal para evitar conflito com as marcas anteriores identificadas. A decisão final sobre a estratégia de depósito deve ser tomada com acompanhamento profissional.",
      ],
    },
    {
      clientId: techNova.id,
      caseId: patenteIrrigacao.id,
      title: "Relatório descritivo — Sistema de irrigação IoT",
      fileName: "relatorio-descritivo-irrigacao-iot.txt",
      sourceType: "USER_UPLOAD" as const,
      chunks: [
        "Relatório descritivo da invenção: o sistema de irrigação inteligente compreende uma rede de sensores de umidade do solo distribuídos em malha, uma estação meteorológica local e uma unidade central de processamento que executa algoritmo preditivo de demanda hídrica. Os sensores comunicam-se por protocolo LoRaWAN de baixo consumo energético.",
        "O algoritmo preditivo considera séries históricas de umidade, previsão meteorológica e estágio fenológico da cultura para determinar o momento e o volume ótimos de irrigação, reduzindo o consumo de água em até 40% em comparação com sistemas temporizados convencionais.",
        "Reivindicação principal: sistema de irrigação automatizado caracterizado por compreender sensores de umidade em malha, estação meteorológica integrada e unidade de controle com modelo preditivo, em que a decisão de irrigação combina dados de solo em tempo real com previsão climática local.",
      ],
    },
    {
      clientId: null,
      caseId: null,
      title: "Lei 9.279/96 — Dispositivos sobre marcas (extrato)",
      fileName: "lei-9279-marcas-extrato.txt",
      sourceType: "LAW" as const,
      chunks: [
        "Art. 122. São suscetíveis de registro como marca os sinais distintivos visualmente perceptíveis, não compreendidos nas proibições legais. Art. 123. Considera-se marca de produto ou serviço aquela usada para distinguir produto ou serviço de outro idêntico, semelhante ou afim, de origem diversa.",
        "Art. 124. Não são registráveis como marca, entre outros: sinais de caráter genérico, necessário, comum, vulgar ou simplesmente descritivo, quando tiver relação com o produto ou serviço a distinguir; reprodução ou imitação de marca alheia registrada, para distinguir produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação.",
        "Art. 158. Protocolado o pedido de registro, será publicado para apresentação de oposição no prazo de 60 (sessenta) dias. O depositante será intimado da oposição, podendo se manifestar no prazo de 60 (sessenta) dias.",
      ],
    },
    {
      clientId: null,
      caseId: null,
      title: "Manual de Marcas do INPI — Classificação de Nice (resumo)",
      fileName: "manual-marcas-nice-resumo.txt",
      sourceType: "MANUAL" as const,
      chunks: [
        "A Classificação Internacional de Nice organiza produtos e serviços em 45 classes: classes 1 a 34 para produtos e classes 35 a 45 para serviços. A especificação deve indicar com precisão os produtos ou serviços que a marca visa distinguir. Exemplos: classe 25 abrange vestuário, calçados e chapelaria; classe 30 abrange café, chá, cacau e produtos de padaria; classe 42 abrange serviços científicos e tecnológicos, incluindo desenvolvimento de software.",
        "Na escolha das classes, deve-se considerar a atividade efetiva do titular e a expansão futura pretendida. O exame de colidência considera a afinidade mercadológica entre produtos e serviços, podendo haver conflito entre classes distintas quando há relação de afinidade.",
      ],
    },
  ];

  let totalChunks = 0;
  const seededDocs: Array<{ id: string; title: string; chunkIds: string[]; chunkTexts: string[] }> = [];

  for (const doc of documentsData) {
    const created = await prisma.document.create({
      data: {
        organizationId: org.id,
        clientId: doc.clientId,
        caseId: doc.caseId,
        title: doc.title,
        fileName: doc.fileName,
        fileUrl: `seed/${doc.fileName}`,
        mimeType: "text/plain",
        sizeBytes: doc.chunks.join("\n").length,
        sourceType: doc.sourceType,
        status: "READY",
      },
    });

    const chunkIds: string[] = [];
    for (let i = 0; i < doc.chunks.length; i++) {
      const chunk = await prisma.documentChunk.create({
        data: {
          documentId: created.id,
          organizationId: org.id,
          content: doc.chunks[i],
          chunkIndex: i,
          pageNumber: null,
          metadata: { fileName: doc.fileName, sourceType: doc.sourceType, seeded: true },
        },
      });
      const embedding = hashedBagOfWordsEmbedding(doc.chunks[i]);
      await prisma.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${`[${embedding.join(",")}]`}::vector
        WHERE id = ${chunk.id}
      `;
      chunkIds.push(chunk.id);
      totalChunks += 1;
    }

    seededDocs.push({
      id: created.id,
      title: created.title,
      chunkIds,
      chunkTexts: doc.chunks,
    });
  }

  // 8. Conversas com IA (2)
  const conv1 = await prisma.aiConversation.create({
    data: {
      organizationId: org.id,
      userId: ana.id,
      caseId: marcaBella.id,
      title: "Risco de colisão da marca Bella Moda",
    },
  });
  await prisma.aiMessage.create({
    data: {
      conversationId: conv1.id,
      role: "USER",
      content: "Qual o risco de colisão da marca Bella Moda na classe 25?",
    },
  });
  const conv1Answer = await prisma.aiMessage.create({
    data: {
      conversationId: conv1.id,
      role: "ASSISTANT",
      content:
        "Com base na busca de anterioridade interna [Fonte 1], foram identificadas as marcas BELA MODA FASHION (registro vigente) e BELLAMODAS (pedido em exame) na classe 25, com forte semelhança gráfica e fonética. Isso indica risco ALTO de colidência e possível indeferimento com fundamento no art. 124 da Lei 9.279/96.\n\nPróximos passos: (1) avaliar elemento distintivo adicional no conjunto marcário; (2) considerar apresentação mista com figura forte; (3) validar a estratégia com agente da propriedade industrial.\n\nAnálise assistiva — não substitui consulta profissional ou oficial ao INPI.",
      metadata: { model: "mock-provider", retrievedChunks: 2, seeded: true },
    },
  });
  const buscaDoc = seededDocs[1];
  await prisma.aiCitation.create({
    data: {
      messageId: conv1Answer.id,
      documentId: buscaDoc.id,
      chunkId: buscaDoc.chunkIds[0],
      sourceTitle: buscaDoc.title,
      quote: buscaDoc.chunkTexts[0].slice(0, 220) + "…",
    },
  });

  const conv2 = await prisma.aiConversation.create({
    data: {
      organizationId: org.id,
      userId: bruno.id,
      title: "Prazo de oposição após publicação de marca",
    },
  });
  await prisma.aiMessage.create({
    data: {
      conversationId: conv2.id,
      role: "USER",
      content: "Qual o prazo para terceiros apresentarem oposição após a publicação do pedido de marca?",
    },
  });
  const conv2Answer = await prisma.aiMessage.create({
    data: {
      conversationId: conv2.id,
      role: "ASSISTANT",
      content:
        "Conforme o art. 158 da Lei 9.279/96 [Fonte 1], protocolado o pedido de registro, ele será publicado para apresentação de oposição no prazo de 60 (sessenta) dias. Havendo oposição, o depositante é intimado e pode se manifestar em igual prazo de 60 dias.\n\nPróximos passos: monitorar a RPI para identificar oposições dentro do prazo e preparar eventual manifestação.\n\nAnálise assistiva — confirme prazos no acompanhamento oficial do processo no INPI.",
      metadata: { model: "mock-provider", retrievedChunks: 1, seeded: true },
    },
  });
  const leiDoc = seededDocs[3];
  await prisma.aiCitation.create({
    data: {
      messageId: conv2Answer.id,
      documentId: leiDoc.id,
      chunkId: leiDoc.chunkIds[2],
      sourceTitle: leiDoc.title,
      quote: leiDoc.chunkTexts[2].slice(0, 220) + "…",
    },
  });

  // 9. Alertas (3)
  await prisma.alert.createMany({
    data: [
      {
        organizationId: org.id,
        caseId: marcaSerrano.id,
        title: "Prazo de oposição em curso — Café Serrano",
        description:
          "O pedido foi publicado na RPI. Terceiros podem apresentar oposição no prazo legal. Monitorar publicações semanais.",
        severity: "WARNING",
        status: "OPEN",
        dueDate: daysFromNow(20),
      },
      {
        organizationId: org.id,
        caseId: marcaTechNova.id,
        title: "Pagamento da concessão — AgroSense",
        description: "Marca deferida. Efetuar o pagamento da taxa de concessão dentro do prazo ordinário.",
        severity: "CRITICAL",
        status: "OPEN",
        dueDate: daysFromNow(5),
      },
      {
        organizationId: org.id,
        caseId: patenteIrrigacao.id,
        title: "Publicação do pedido confirmada",
        description: "O pedido de patente foi publicado na RPI. Nenhuma ação imediata necessária.",
        severity: "INFO",
        status: "RESOLVED",
      },
    ],
  });

  // 10. Prazos (3)
  await prisma.deadline.createMany({
    data: [
      {
        organizationId: org.id,
        caseId: marcaTechNova.id,
        title: "Pagar taxa de concessão — AgroSense",
        description: "Prazo ordinário para pagamento da concessão do registro deferido.",
        dueDate: daysFromNow(5),
        status: "PENDING",
      },
      {
        organizationId: org.id,
        caseId: marcaSerrano.id,
        title: "Fim do prazo de oposição — Café Serrano",
        description: "Término do prazo legal de 60 dias para oposição de terceiros.",
        dueDate: daysFromNow(20),
        status: "PENDING",
      },
      {
        organizationId: org.id,
        caseId: patenteEmbalagem.id,
        title: "Requerer exame técnico — embalagem café",
        description: "Requerimento de exame do modelo de utilidade dentro do prazo legal.",
        dueDate: daysFromNow(90),
        status: "PENDING",
      },
    ],
  });

  // 11. Documentos gerados (2)
  await prisma.generatedDocument.create({
    data: {
      organizationId: org.id,
      caseId: marcaBella.id,
      type: "PRELIMINARY_OPINION",
      title: "Parecer preliminar de marca — Bella Moda",
      status: "DRAFT",
      content: `PARECER PRELIMINAR DE VIABILIDADE DE MARCA

1. Resumo executivo
A marca BELLA MODA (classe 25) apresenta risco ALTO de colidência com registros anteriores identificados em busca preliminar.

2. Dados analisados
- Marca: BELLA MODA (mista) — classe Nice 25 (vestuário).
- Busca de anterioridade interna com dois sinais semelhantes identificados.

3. Possíveis riscos
- Indeferimento com fundamento no art. 124, XIX, da Lei 9.279/96, por semelhança com BELA MODA FASHION (registro vigente).
- Oposição do titular da marca anterior.

4. Pontos de atenção
- Expressões "bella" e "moda" possuem baixa distintividade para vestuário.

5. Próximos passos recomendados
- Avaliar elemento distintivo adicional no conjunto marcário.
- Considerar nova busca após ajuste do sinal.
- Submeter a estratégia a agente da propriedade industrial.

6. Limitações da análise
Baseada exclusivamente nos documentos internos disponíveis; não inclui busca oficial completa no INPI.

7. Aviso
Esta análise é assistiva e não substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI.`,
    },
  });

  await prisma.generatedDocument.create({
    data: {
      organizationId: org.id,
      caseId: patenteIrrigacao.id,
      type: "PATENT_ANALYSIS",
      title: "Análise preliminar de patente — Sistema de irrigação IoT",
      status: "REVIEWED",
      content: `ANÁLISE TÉCNICA PRELIMINAR DE PATENTE

1. Resumo técnico simplificado
Sistema de irrigação que combina sensores de umidade em malha, estação meteorológica local e algoritmo preditivo para decidir quando e quanto irrigar.

2. Campo tecnológico
Agricultura de precisão; automação e controle (IPC A01G 25/16, G05B 19/042).

3. Possíveis anterioridades
Sistemas comerciais de irrigação por gotejamento temporizado; publicações sobre controle preditivo agrícola. Recomenda-se busca formal de anterioridade.

4. Riscos
- Obviedade da combinação de sensores + previsão meteorológica, caso as anterioridades revelem soluções equivalentes.

5. Pontos de novidade aparente
- Integração do estágio fenológico da cultura no modelo preditivo local com comunicação LoRaWAN.

6. Próximos passos
- Realizar busca de anterioridade formal (INPI, Espacenet, Patentscope).
- Preparar resposta técnica a eventuais exigências do exame.

7. Limitações da análise
Análise assistiva baseada nos documentos internos; não substitui busca de anterioridade formal nem o exame técnico do INPI.`,
    },
  });

  // 12. Logs de auditoria iniciais
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        userId: ana.id,
        action: "seed.executed",
        entityType: "Organization",
        entityId: org.id,
        metadata: { note: "Dados de demonstração criados." },
      },
      {
        organizationId: org.id,
        userId: ana.id,
        action: "client.created",
        entityType: "Client",
        entityId: cafeSerrano.id,
        metadata: { name: cafeSerrano.name },
      },
      {
        organizationId: org.id,
        userId: bruno.id,
        action: "case.created",
        entityType: "IndustrialPropertyCase",
        entityId: patenteIrrigacao.id,
        metadata: { type: "PATENT" },
      },
    ],
  });

  console.log("✅ Seed concluído:");
  console.log(`   Organização: ${org.name}`);
  console.log("   Usuários: ana@demopi.com.br / bruno@demopi.com.br (senha: demo1234)");
  console.log(`   Clientes: 3 · Marcas: 3 · Patentes: 2`);
  console.log(`   Documentos: ${seededDocs.length} · Chunks com embedding: ${totalChunks}`);
  console.log("   Conversas: 2 · Alertas: 3 · Prazos: 3 · Documentos gerados: 2");
}

main()
  .catch((error) => {
    console.error("❌ Erro no seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
