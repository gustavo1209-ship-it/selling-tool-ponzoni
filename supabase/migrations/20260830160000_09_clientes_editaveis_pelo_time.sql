-- Cliente é dado compartilhado, como o lote: quem atende hoje pode não ser
-- quem cadastrou. Prender a edição ao autor só criava cliente duplicado.
-- Mesma regra que `lotes` já usa; `criado_por` continua registrado.

drop policy "clientes: time escreve" on clientes;
drop policy "clientes: autor edita" on clientes;
drop policy "clientes: autor apaga" on clientes;

create policy "clientes: time cria" on clientes
  for insert to authenticated with check (true);
create policy "clientes: time edita" on clientes
  for update to authenticated using (true) with check (true);
create policy "clientes: autor ou admin apaga" on clientes
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));
